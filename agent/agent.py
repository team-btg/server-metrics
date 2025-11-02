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
AGENT_DIR = Path.home() / ".monitor_agent"
KEY_FILE = AGENT_DIR / "agent_private.pem"
META_FILE = AGENT_DIR / "agent_meta.json"
LOG_STATE_FILE = AGENT_DIR / "log_state.json"
BACKEND_URL = os.getenv("API_URL", "http://localhost:8000/api/v1")   # configurable
SAMPLE_INTERVAL = 10   # seconds
BATCH_INTERVAL = 30    # seconds
MAX_RETRIES = 5
# New: bounded batch size and TLS verify toggle
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "500"))
VERIFY_SSL = os.getenv("VERIFY_SSL", "true").strip().lower() not in ("0", "false", "no")
SESSION = requests.Session()

last_net_io = psutil.net_io_counters()
last_net_time = time.time()
last_disk_io = psutil.disk_io_counters()
last_disk_time = time.time()

# ==============================
# UTILITIES
# ==============================
def ensure_agent_dir():
    AGENT_DIR.mkdir(parents=True, exist_ok=True)


def load_or_generate_key():
    if KEY_FILE.exists():
        with open(KEY_FILE, "rb") as f:
            sk = SigningKey.from_pem(f.read())
    else:
        sk = SigningKey.generate(curve=NIST256p)
        with open(KEY_FILE, "wb") as f:
            f.write(sk.to_pem())
        # Restrict perms on POSIX
        if os.name == "posix":
            try:
                os.chmod(KEY_FILE, 0o600)
            except Exception:
                pass
    return sk


def pubkey_pem(sk: SigningKey) -> str:
    return sk.get_verifying_key().to_pem().decode()


def get_hardware_fingerprint():
    # Very naive for MVP: combine hostname + MAC
    hostname = socket.gethostname()
    mac = uuid.getnode()
    raw = f"{hostname}-{mac}".encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def save_meta(meta: dict):
    with open(META_FILE, "w") as f:
        json.dump(meta, f)


def load_meta():
    if META_FILE.exists():
        with open(META_FILE, "r") as f:
            return json.load(f)
    return None


def exponential_backoff(attempt):
    # Add small jitter to avoid thundering herd
    base = min(60, 2 ** attempt)
    return base + random.uniform(0, 1)


# ==============================
# REGISTRATION
# ==============================
def register(sk: SigningKey):
    url = f"{BACKEND_URL}/register"
    payload = {
        "pubkey": pubkey_pem(sk),
        "fingerprint": get_hardware_fingerprint(),
        "hostname": socket.gethostname(),
        "tags": {"os": platform.system(), "arch": platform.machine()},
    }
    for attempt in range(MAX_RETRIES):
        try:
            r = SESSION.post(url, json=payload, timeout=10, verify=VERIFY_SSL)
            if r.status_code in (200, 201):
                meta = r.json()
                save_meta(meta)
                print(f"[OK] Registered as {meta.get('server_id')}")
                return meta
            else:
                print(f"[ERR] Registration failed {r.status_code}: {r.text}")
        except Exception as e:
            print(f"[ERR] Registration attempt {attempt}: {e}")
        time.sleep(exponential_backoff(attempt))
    raise RuntimeError("Failed to register after retries")


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
def push_batch(batch, token):
    if not batch:
        return True, False
    url = f"{BACKEND_URL}/metrics"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
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
def push_logs(batch, token):
    if not batch:
        return True, False
    url = f"{BACKEND_URL}/logs"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
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

def logs_worker(server_id, token, stop_event):
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
            ok, unauthorized = push_logs(batch, token)
            if unauthorized:
                meta = register(load_or_generate_key())
                token = meta.get("token")
                ok, _ = push_logs(batch, token)
            if ok:
                batch.clear()
                last_push = time.time()

        stop_event.wait(2)  # check logs every 2s

def collect_logs(server_id, limit=50):
    logs = []
    system = platform.system()

    if system == "Windows":
        try:
            import win32evtlog
            import win32evtlogutil

            # Load the last record number we processed
            last_record_number = 0
            if LOG_STATE_FILE.exists():
                with open(LOG_STATE_FILE, "r") as f:
                    state = json.load(f)
                    last_record_number = state.get("last_record_number", 0)

            server = 'localhost'
            logtype = 'System'
            hand = win32evtlog.OpenEventLog(server, logtype)
            
            # Read forward from the last known record
            flags = win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
            
            newest_record_number = last_record_number
            
            events_read = 0
            while events_read < limit:
                events = win32evtlog.ReadEventLog(hand, flags, last_record_number)
                if not events:
                    break

                for ev in events:
                    # Skip records we've already processed
                    if ev.RecordNumber <= last_record_number:
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
                    
                    newest_record_number = max(newest_record_number, ev.RecordNumber)
                    events_read += 1
                    if events_read >= limit:
                        break
                
                # If we processed events, update the starting point for the next read call in this loop
                last_record_number = newest_record_number
                if events_read >= limit:
                    break

            win32evtlog.CloseEventLog(hand)

            # Save the newest record number for the next run
            if newest_record_number > 0:
                with open(LOG_STATE_FILE, "w") as f:
                    json.dump({"last_record_number": newest_record_number}, f)

        except ImportError:
            print("[WARN] 'pywin32' not installed. Cannot fetch Windows Event Logs.")
        except Exception as e:
            print(f"[ERR] Could not fetch Windows logs: {e}")

    elif system == "Linux":
        try:
            with open("/var/log/syslog", "r") as f:
                lines = f.readlines()[-limit:]
            for line in lines:
                logs.append({
                    "server_id": server_id,
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "level": "Info",
                    "source": "syslog",
                    "event_id": None,
                    "message": line.strip(),
                    "meta": {}
                })
        except Exception as e:
            print("[ERR] Could not fetch syslog:", e)

    return logs

# ==============================
# MAIN LOOP
# ==============================
def main():
    ensure_agent_dir()
    sk = load_or_generate_key()
    meta = load_meta()
    if not meta:
        meta = register(sk)
    # Ensure we have a token (older meta may not include it); re-register returns existing id with token
    if "token" not in meta or not meta.get("token"):
        meta = register(sk)

    server_id = meta["server_id"]
    token = meta.get("token")

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

    log_thread = threading.Thread(target=logs_worker, args=(server_id, token, stop_event), daemon=True)
    log_thread.start()
    
    try:
        while not stop_event.is_set():
            sample = collect_metrics(server_id)
            batch.append(sample)

            time_to_push = (time.time() - last_push) >= BATCH_INTERVAL
            size_to_push = len(batch) >= MAX_BATCH_SIZE
            if time_to_push or size_to_push:
                ok, unauthorized = push_batch(batch, token)
                if unauthorized:
                    # Refresh token then retry once
                    meta = register(sk)
                    token = meta.get("token")
                    ok, _ = push_batch(batch, token)
                if ok:
                    batch.clear()
                    last_push = time.time()

            # Wait with wake-on-signal
            stop_event.wait(SAMPLE_INTERVAL)
    finally:
        # Final flush on shutdown
        if batch:
            print("[INFO] Flushing remaining samples...")
            ok, unauthorized = push_batch(batch, token)
            if not ok and unauthorized:
                try:
                    meta = register(sk)
                    token = meta.get("token")
                    push_batch(batch, token)
                except Exception as e:
                    print(f"[ERR] Final flush failed: {e}")
        try:
            SESSION.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
