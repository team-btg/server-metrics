#!/usr/bin/env python3
import os
import json
import time
import socket
import uuid
import hashlib
import platform
from pathlib import Path
import requests
import psutil
from ecdsa import SigningKey, NIST256p
import threading
import signal
import random
import datetime
import sys 
 
# ==============================
# CONFIG
# ==============================
if platform.system() == "Windows":
    # Use C:\ProgramData - the standard location for shared app data
    AGENT_DIR = Path(os.environ.get("PROGRAMDATA", "C:/")) / "ServerMetricsAgent"
else:
    # For Linux/macOS, /etc/ is a standard location for system-wide config
    AGENT_DIR = Path("/etc/server-metrics-agent")

CONFIG_FILE = AGENT_DIR / "config.json" 
KEY_FILE = AGENT_DIR / "agent_private.pem"
META_FILE = AGENT_DIR / "agent_meta.json"
LOG_STATE_FILE = AGENT_DIR / "log_state.json" 
SAMPLE_INTERVAL = 10   # seconds
BATCH_INTERVAL = 30    # seconds
MAX_RETRIES = 5 
SESSION = requests.Session()

last_net_io = psutil.net_io_counters()
last_net_time = time.time()
last_disk_io = psutil.disk_io_counters()
last_disk_time = time.time()

# ==============================
# UTILITIES
# ==============================  
def load_or_create_config():
    """Loads config from file, or prompts user to create it if it doesn't exist."""
    AGENT_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    else:
        print("--- Server-Metrics Agent First-Time Setup ---")
        print(f"Configuration will be saved to: {CONFIG_FILE}")
        print("You can edit this file manually later if you need to change these settings.")
        print("-" * 50)

        # Prompt for Backend URL with validation
        while True:
            url = input("Enter your Backend URL (e.g., http://your-server.com/api/v1): ").strip()
            if url.startswith("http://") or url.startswith("https://"):
                break
            print("[ERROR] Invalid URL. Please ensure it starts with 'http://' or 'https://'.")
        
        # Prompt for Max Batch Size with validation
        while True:
            size_str = input("Enter max batch size for metrics [Default: 500]: ").strip()
            if not size_str:
                size = 500
                break
            try:
                size = int(size_str)
                if size > 0:
                    break
                print("[ERROR] Batch size must be a positive number.")
            except ValueError:
                print("[ERROR] Please enter a valid number.")

        # Prompt for SSL Verification with validation
        while True:
            ssl_str = input("Verify SSL certificate? (yes/no) [Default: yes]: ").strip().lower()
            if not ssl_str or ssl_str in ['y', 'yes']:
                verify = True
                break
            if ssl_str in ['n', 'no']:
                verify = False
                break
            print("[ERROR] Please answer with 'yes' or 'no'.")

        config = {
            "BACKEND_URL": url,
            "MAX_BATCH_SIZE": size,
            "VERIFY_SSL": verify
        }
        
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
            
        print("-" * 50)
        print("Configuration saved successfully. The agent will now start.")
        print("-" * 50)
        time.sleep(2)
        return config

def exponential_backoff(attempt):
    # Add small jitter to avoid thundering herd
    base = min(60, 2 ** attempt)
    return base + random.uniform(0, 1)
 
# ==============================
# REGISTRATION
# ==============================
def load_or_register_agent(BACKEND_URL):
    AGENT_DIR.mkdir(exist_ok=True)
    if META_FILE.exists():
        with open(META_FILE, "r") as f:
            meta = json.load(f)
            print(f"[INFO] Agent already registered. Server ID: {meta['server_id']}")
            return meta['server_id'], meta['api_key']

    print("[INFO] No existing registration found. Registering new agent...")
    hostname = socket.gethostname()
    payload = {"hostname": hostname, "tags": []}
    
    try:
        r = requests.post(f"{BACKEND_URL}/agent/register", json=payload, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        server_id = data['id']
        api_key = data['api_key']

        with open(META_FILE, "w") as f:
            json.dump({"server_id": server_id, "api_key": api_key}, f)
        
        print("\n" + "="*50)
        print("AGENT REGISTRATION SUCCESSFUL")
        print("Please add this server to your dashboard using the following details:")
        print(f"  Server ID: {server_id}")
        print(f"  API Key:   {api_key}")
        print("="*50 + "\n")
        
        return server_id, api_key
    except Exception as e:
        print(f"[FATAL] Could not register agent with backend: {e}")
        return None, None
 
# ==============================
# METRICS COLLECTION
# ==============================
def collect_metrics(server_id):
    global last_net_io, last_net_time, last_disk_io, last_disk_time
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # CPU and memory
    cpu_percent = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory()

    # Disk usage per partition
    disk_usage = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disk_usage.append({
                "mountpoint": part.mountpoint,
                "total_gb": round(usage.total / (1024**3), 2),
                "used_gb": round(usage.used / (1024**3), 2),
                "percent": usage.percent
            })
        except PermissionError:
            continue

    # Network interfaces
    net_info = []
    for iface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family.name in ('AF_INET'):
                net_info.append({
                    "interface": iface,
                    "address": addr.address,
                    "netmask": addr.netmask,
                    "broadcast": addr.broadcast
                })

    # Disk I/O statistics
    current_disk_io = psutil.disk_io_counters()
    current_disk_time = time.time()
    disk_time_delta = current_disk_time - last_disk_time
    read_bytes_delta = current_disk_io.read_bytes - last_disk_io.read_bytes
    write_bytes_delta = current_disk_io.write_bytes - last_disk_io.write_bytes
    
    if disk_time_delta > 0:
        disk_read_mbps = round((read_bytes_delta * 8) / disk_time_delta / 1_000_000, 2)
        disk_write_mbps = round((write_bytes_delta * 8) / disk_time_delta / 1_000_000, 2)
    else:
        disk_read_mbps = 0.0
        disk_write_mbps = 0.0

    last_disk_io = current_disk_io 
    last_disk_time = current_disk_time    
    
    # Network I/O statistics - SEPARATE INCOMING AND OUTGOING
    current_net_io = psutil.net_io_counters()
    current_net_time = time.time()
    
    # Calculate time and data deltas
    time_delta = current_net_time - last_net_time
    bytes_sent_delta = current_net_io.bytes_sent - last_net_io.bytes_sent
    bytes_recv_delta = current_net_io.bytes_recv - last_net_io.bytes_recv

    # Calculate rate in Megabits per second (Mbps)
    # Avoid division by zero on the first run or if time hasn't passed
    if time_delta > 0:
        # (bytes * 8) / seconds = bits per second
        # bps / 1,000,000 = Mbps
        network_in_mbps = round((bytes_recv_delta * 8) / time_delta / 1_000_000, 2)
        network_out_mbps = round((bytes_sent_delta * 8) / time_delta / 1_000_000, 2)
    else:
        network_in_mbps = 0.0
        network_out_mbps = 0.0
    
    network_total_mbps = network_in_mbps + network_out_mbps

    # Update state for the next collection
    last_net_io = current_net_io
    last_net_time = current_net_time
    
    # Get detailed OS info without distro package
    system = platform.system()
    if system == "Linux":
        try:
            with open('/etc/os-release', 'r') as f:
                lines = f.readlines()
                os_name = ""
                for line in lines:
                    if line.startswith('PRETTY_NAME='):
                        os_name = line.split('=')[1].strip().strip('"')
                        break
                if not os_name:
                    os_name = f"{platform.system()} {platform.release()}"
        except:
            os_name = f"{platform.system()} {platform.release()}"
    else:
        os_name = f"{platform.system()} {platform.release()}"

    # Get kernel version
    kernel_version = platform.release()

    # Get CPU info
    cpu_info = psutil.cpu_freq()
    cpu_model = " ".join(platform.processor().split()[:3]) if platform.processor() else "Unknown"
    cpu_speed = round(cpu_info.current / 1000, 1) if cpu_info else "N/A"

    # Get uptime in days
    uptime_seconds = time.time() - psutil.boot_time()
    uptime_days = round(uptime_seconds / (24 * 3600), 1)

    # Get load average
    try:
        load_avg = os.getloadavg()[0] if hasattr(os, 'getloadavg') else psutil.getloadavg()[0]
    except:
        load_avg = "N/A"

    # --- Get Top 5 Processes by CPU ---
    processes_with_metrics = []
    for p in psutil.process_iter(['pid', 'name']):
        try:
            # Get CPU usage over a small interval
            p.info['cpu_percent'] = p.cpu_percent(interval=0.01)
            # Get memory usage (instantaneous)
            p.info['memory_percent'] = p.memory_percent()
            processes_with_metrics.append(p.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            # This gracefully handles processes that disappear during collection
            pass

    # Sort by CPU and get top 5
    top_cpu_processes = sorted(processes_with_metrics, key=lambda p: p.get('cpu_percent', 0), reverse=True)[:5]

    # Sort by Memory and get top 5
    top_mem_processes = sorted(processes_with_metrics, key=lambda p: p.get('memory_percent', 0), reverse=True)[:5]
    
    # --- Combine and de-duplicate the lists ---
    combined_processes = {p['pid']: p for p in top_cpu_processes}
    for p in top_mem_processes:
        if p['pid'] not in combined_processes:
            combined_processes[p['pid']] = p
        # No 'else' needed, as the initial dict already contains the full info for top_cpu processes

    processes = list(combined_processes.values())
 
    # Enhanced server details
    server_info = {
        "hostname": socket.gethostname(),
        "os": platform.system(),
        "os_name": os_name,
        "os_version": platform.version(),
        "arch": platform.machine(),
        "cores": psutil.cpu_count(logical=True),
        "memory_gb": round(mem.total / (1024**3), 2),
        "kernel_version": kernel_version,
        "ram_type": "",
        "cpu_model": cpu_model,
        "cpu_speed": cpu_speed,
    }

    return {
        "server_id": server_id,
        "timestamp": ts,
        "metrics": [
            {"name": "cpu.percent", "value": cpu_percent},
            {"name": "mem.percent", "value": mem.percent},
            {"name": "disk", "value": disk_usage},
            {"name": "network", "value": net_info},
        ],
        "processes": processes,
        "meta": {
            "uptime": int(uptime_seconds),
            "uptime_days": uptime_days,
            "load_avg": load_avg,
            "disk_percent": disk_usage[0]["percent"] if disk_usage else 0,
            "disk_read_mbps": disk_read_mbps,
            "disk_write_mbps": disk_write_mbps,
            # Separate network metrics
            "network_in": network_in_mbps,    # MB received
            "network_out": network_out_mbps,  # MB sent
            "network_total": network_total_mbps,  # Total MB
            "server_info": server_info,
            "formatted": {
                "name": server_info["hostname"],
                "os": server_info["os_name"],
                "kernel": server_info["kernel_version"],
                "ram": f"{server_info['memory_gb']} GB {server_info['ram_type']}",
                "cpu": f"{server_info['cpu_model']} ({server_info['cores']} cores, {server_info['cpu_speed']} GHz)",
                "uptime": f"{uptime_days} days",
                "load_avg": load_avg,
                "disk_percent": f"{disk_usage[0]['percent'] if disk_usage else 0}%",
                "disk_read_mbps": f"{disk_read_mbps}",
                "disk_write_mbps": f"{disk_write_mbps}",
                "network_total": f"{network_total_mbps}",  # Keep total for backward compatibility
                "network_in": f"{network_in_mbps}",
                "network_out": f"{network_out_mbps}"
            }
        }
    }

# ==============================
# METRICS PUSH
# ==============================
def push_batch(batch, api_key, BACKEND_URL, VERIFY_SSL):
    if not batch:
        return True, False
    url = f"{BACKEND_URL}/metrics"
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
    for attempt in range(MAX_RETRIES):
        try: 
            r = SESSION.post(url, json=batch, headers=headers, timeout=10, verify=VERIFY_SSL)
            if r.status_code in (200, 202):
                try:
                    data = r.json()
                    accepted = data.get("accepted", len(batch)) if isinstance(data, dict) else len(batch)
                except Exception:
                    accepted = len(batch) 
                return True, False
            elif r.status_code == 401:
                print("[ERR] Unauthorized (401). Token may be invalid or expired.")
                return False, True
            else:
                print(f"[ERR] Push failed {r.status_code}: {r.text}")
        except Exception as e:
            print(f"[ERR] Push attempt {attempt}: {e}")
        time.sleep(exponential_backoff(attempt))
    return False, False

# ==============================
# LOGS COLLECTION
# ==============================
def push_logs(batch, api_key, BACKEND_URL, VERIFY_SSL):
    if not batch:
        return True, False
    url = f"{BACKEND_URL}/logs"
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
    for attempt in range(MAX_RETRIES):
        try: 
            r = SESSION.post(url, json=batch, headers=headers, timeout=10, verify=VERIFY_SSL)
            if r.status_code in (200, 202):
                try:
                    data = r.json()
                    accepted = data.get("accepted", len(batch)) if isinstance(data, dict) else len(batch)
                except Exception:
                    accepted = len(batch) 
                return True, False
            elif r.status_code == 401:
                print("[ERR] Unauthorized (401). Token may be invalid or expired.")
                return False, True
            else:
                print(f"[ERR] Push failed {r.status_code}: {r.text}")
        except Exception as e:
            print(f"[ERR] Push attempt {attempt}: {e}")
        time.sleep(exponential_backoff(attempt))
    return False, False

def logs_worker(server_id, token, stop_event, BACKEND_URL, VERIFY_SSL):
    batch = []
    last_push = time.time()

    while not stop_event.is_set():
        # Grab new logs since last call
        new_logs = collect_logs(server_id)  
        if new_logs:
            batch.extend(new_logs)

        # Flush periodically
        time_to_push = (time.time() - last_push) >= 10 or len(batch) >= 50
        if time_to_push and batch:
            ok, unauthorized = push_logs(batch, token, BACKEND_URL, VERIFY_SSL)
            if unauthorized: 
                ok, _ = push_logs(batch, token, BACKEND_URL, VERIFY_SSL)
            if ok:
                batch.clear()
                last_push = time.time()

        stop_event.wait(2)  # check logs every 2s

def collect_logs(server_id, limit=50):
    logs = []
    system = platform.system()
    
    # Load the last known state for logs
    state = {}
    if LOG_STATE_FILE.exists():
        try:
            with open(LOG_STATE_FILE, "r") as f:
                state = json.load(f)
        except json.JSONDecodeError:
            state = {}

    if system == "Windows":
        try:
            import win32evtlog
            # Constants for event types
            EVENTLOG_ERROR_TYPE = 1
            EVENTLOG_AUDIT_FAILURE_TYPE = 16

            last_record_number = state.get("last_record_number", 0)
            
            server = 'localhost'
            logtype = 'System'
            hand = win32evtlog.OpenEventLog(server, logtype)
            
            flags = win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
            
            if last_record_number == 0:
                total_records = win32evtlog.GetNumberOfEventLogRecords(hand)
                last_record_number = max(0, total_records - limit)

            events = win32evtlog.ReadEventLog(hand, flags, last_record_number)
            
            newest_record_number = last_record_number
            
            if events:
                for ev in events:
                    if ev.RecordNumber <= last_record_number:
                        continue
                    
                    newest_record_number = max(newest_record_number, ev.RecordNumber)

                    # --- FILTERING LOGIC FOR WINDOWS ---
                    # Only include Error events or Audit Failures
                    if ev.EventType not in [EVENTLOG_ERROR_TYPE, EVENTLOG_AUDIT_FAILURE_TYPE]:
                        continue

                    logs.append({
                        "server_id": server_id,
                        "timestamp": ev.TimeGenerated.isoformat(),
                        "level": str(ev.EventType),
                        "source": ev.SourceName,
                        "event_id": str(ev.EventID),
                        "message": " ".join(s for s in ev.StringInserts if s) if ev.StringInserts else "No message",
                        "meta": {"record_number": ev.RecordNumber}
                    })
            
            win32evtlog.CloseEventLog(hand)

            if newest_record_number > last_record_number:
                state["last_record_number"] = newest_record_number
                with open(LOG_STATE_FILE, "w") as f:
                    json.dump(state, f)

        except ImportError:
            print("[WARN] 'pywin32' not installed. Cannot fetch Windows Event Logs.")
        except Exception as e:
            print(f"[ERR] Could not fetch Windows logs: {e}")

    elif system == "Linux":
        log_file_path = "/var/log/syslog"
        last_pos = state.get("syslog_pos", 0)
        
        try:
            if not os.path.exists(log_file_path):
                return []

            with open(log_file_path, "r", encoding='utf-8', errors='ignore') as f:
                current_size = os.fstat(f.fileno()).st_size
                if current_size < last_pos:
                    last_pos = 0
                
                f.seek(last_pos)
                lines = f.readlines()
                new_pos = f.tell()

            for line in lines:
                line_lower = line.lower()
                # --- FILTERING LOGIC FOR LINUX ---
                # Only include lines containing 'error', 'critical', 'fail', or 'failed'
                if not any(keyword in line_lower for keyword in ['error', 'critical', 'fail', 'failed']):
                    continue

                # Determine level from content
                level = "Error"
                if "critical" in line_lower:
                    level = "Critical"

                logs.append({
                    "server_id": server_id,
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "level": level,
                    "source": "syslog",
                    "event_id": None,
                    "message": line.strip(),
                    "meta": {}
                })
            
            if new_pos > last_pos:
                state["syslog_pos"] = new_pos
                with open(LOG_STATE_FILE, "w") as f:
                    json.dump(state, f)

        except PermissionError:
            print(f"[ERR] Permission denied for {log_file_path}. Run agent with sudo or add user to 'adm' group.")
        except Exception as e:
            print(f"[ERR] Could not fetch syslog: {e}")

    return logs

# ==============================
# MAIN LOOP
# ==============================
def main(): 

    if "--configure" in sys.argv:
        print("Running in configuration mode...")
        load_or_create_config()
        print("Configuration complete. You can now install the service.")
        time.sleep(3)
        return # Exit after configuring
    
    config = load_or_create_config()
    BACKEND_URL = config.get("BACKEND_URL")
    MAX_BATCH_SIZE = config.get("MAX_BATCH_SIZE", 500)
    VERIFY_SSL = config.get("VERIFY_SSL", True)

    if not BACKEND_URL:
        print("[FATAL] BACKEND_URL not found in config. Please delete the config file and restart the agent.")
        sys.exit(1)

    server_id, api_key = load_or_register_agent(BACKEND_URL)
    if not api_key:
        return
 
    batch = []
    last_push = time.time()

    # Graceful shutdown handling
    stop_event = threading.Event()
    def handle_signal(signum, _frame):
        print(f"[INFO] Signal {signum} received, shutting down...")
        stop_event.set()
    try:
        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)
    except Exception:
        pass

    print(f"[INFO] Agent started for {server_id}")

    log_thread = threading.Thread(target=logs_worker, args=(server_id, api_key, stop_event, BACKEND_URL, VERIFY_SSL), daemon=True)
    log_thread.start()
    
    try:
        while not stop_event.is_set():
            sample = collect_metrics(server_id)
            batch.append(sample)

            time_to_push = (time.time() - last_push) >= BATCH_INTERVAL
            size_to_push = len(batch) >= MAX_BATCH_SIZE
            if time_to_push or size_to_push:
                ok, unauthorized = push_batch(batch, api_key, BACKEND_URL, VERIFY_SSL)
                if unauthorized:
                    # Refresh token then retry once 
                    ok, _ = push_batch(batch, api_key, BACKEND_URL, VERIFY_SSL)
                if ok:
                    batch.clear()
                    last_push = time.time()

            # Wait with wake-on-signal
            stop_event.wait(SAMPLE_INTERVAL)
    finally:
        # Final flush on shutdown
        if batch:
            print("[INFO] Flushing remaining samples...")
            ok, unauthorized = push_batch(batch, api_key, BACKEND_URL, VERIFY_SSL)
            if not ok and unauthorized:
                try: 
                    push_batch(batch, api_key, BACKEND_URL, VERIFY_SSL)
                except Exception as e:
                    print(f"[ERR] Final flush failed: {e}")
        try:
            SESSION.close()
        except Exception:
            pass

if __name__ == "__main__":
    main()
