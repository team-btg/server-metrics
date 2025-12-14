import os
import sys
import traceback 
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, extract, literal_column
from .. import models
from .. import database 
 
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
 
METRICS_TO_ANALYZE = ["cpu.percent", "mem.percent"] 
LOOKBACK_DAYS = 30

def calculate_baselines():
    """
    Calculates the mean and standard deviation for key metrics for each server,
    grouped by the hour of the day, over the last 30 days.
    """
    print("Starting baseline calculation job...")
     
    database.initialize_database()
    db = database.SessionLocal() 
    
    try:
        servers = db.query(models.Server).all()
        print(f"Found {len(servers)} servers to analyze.")

        for server in servers:
            print(f"\nAnalyzing server: {server.hostname} ({server.id})")
            
            for metric_name in METRICS_TO_ANALYZE:
                print(f"  Calculating baseline for metric: {metric_name}")
 
                metric_value_subquery = literal_column(
                    f"""
                        (SELECT CAST(elem ->> 'value' AS float)
                         FROM jsonb_array_elements(metrics.metrics::jsonb) AS elem
                        WHERE elem ->> 'name' = '{metric_name}')
                    """
                )
 
                # Query to get the mean and stddev grouped by hour
                results = (
                    db.query(
                        extract('hour', models.Metric.timestamp).label('hour_of_day'),
                        func.avg(metric_value_subquery).label('mean'),
                        func.stddev(metric_value_subquery).label('stddev')
                    )
                    .filter(
                        models.Metric.server_id == server.id,
                        models.Metric.timestamp >= datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
                    )
                    .group_by('hour_of_day')
                    .all()
                )

                if not results:
                    print(f"    No data found for {metric_name}. Skipping.")
                    continue

                # Upsert the new baseline values into the database
                for row in results:
                    hour = int(row.hour_of_day)
                    mean = row.mean if row.mean is not None else 0.0
                    stddev = row.stddev if row.stddev is not None else 0.0

                    # Check if a baseline already exists
                    existing_baseline = (
                        db.query(models.MetricBaseline)
                        .filter_by(server_id=server.id, metric_name=metric_name, hour_of_day=hour)
                        .first()
                    )

                    if existing_baseline:
                        # Update existing
                        existing_baseline.mean_value = mean
                        existing_baseline.std_dev_value = stddev
                    else:
                        # Create new
                        new_baseline = models.MetricBaseline(
                            server_id=server.id,
                            metric_name=metric_name,
                            hour_of_day=hour,
                            mean_value=mean,
                            std_dev_value=stddev
                        )
                        db.add(new_baseline)
                
                db.commit()
                print(f"    Successfully updated baseline for {metric_name} across {len(results)} hourly buckets.")

    except Exception as e:
        # --- FIX: Print the full stack trace for detailed debugging ---
        print(f"An error occurred during baseline calculation. See details below:")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
        print("\nBaseline calculation job finished.")

if __name__ == "__main__":
    calculate_baselines()