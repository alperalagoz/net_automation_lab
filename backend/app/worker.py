from netmiko import ConnectHandler
from sqlalchemy.orm import Session
from .models import TaskResult
import json
import os

def process_config_task(task_id: str, config_data: dict, db: Session):
    """
    Background task to configure routers and update DB.
    """
    try:
        # Update status to RUNNING
        task_record = db.query(TaskResult).filter(TaskResult.id == task_id).first()
        if task_record:
            task_record.status = "RUNNING"
            db.commit()

        router_ips = config_data.get("router_ips", [])
        commands = config_data.get("commands", [])
        username = config_data.get("username")
        password = config_data.get("password")
        device_type = config_data.get("device_type", "cisco_ios")

        results = {}

        for ip in router_ips:
            try:
                device = {
                    "device_type": device_type,
                    "host": ip,
                    "username": username,
                    "password": password,
                }
                
                print(f"Connecting to {ip}...")
                net_connect = ConnectHandler(**device)
                
                command_outputs = []
                
                for cmd in commands:
                    cmd = cmd.strip()
                    if not cmd:
                        continue
                    
                    if cmd.lower().startswith("show "):
                        print(f"Running Exec Command: {cmd}")
                        

                        slug = cmd.lower().replace(" ", "_")
                        template_path = os.path.join(os.path.dirname(__file__), "templates", f"{slug}.textfsm")
                        
                        if os.path.exists(template_path):
                             print(f"Using Custom Template: {template_path}")
                             out = net_connect.send_command(cmd, textfsm_template=template_path)
                        else:
                             # Fallback to ntc-templates
                             out = net_connect.send_command(cmd, use_textfsm=True)
                    else:
                        print(f"Running Config Command: {cmd}")
                        out = net_connect.send_config_set([cmd])
                    
                    command_outputs.append({
                        "command": cmd,
                        "output": out
                    })

                net_connect.disconnect()
                results[ip] = command_outputs

            except Exception as e:
                results[ip] = f"Error: {str(e)}"
        

        task_record = db.query(TaskResult).filter(TaskResult.id == task_id).first()
        if task_record:
            task_record.status = "SUCCESS"
            task_record.result = results
            db.commit()

    except Exception as e:
        print(f"Job failed: {e}")
        task_record = db.query(TaskResult).filter(TaskResult.id == task_id).first()
        if task_record:
            task_record.status = "FAILURE"
            task_record.result = {"error": str(e)}
            db.commit()
    finally:
        db.close()
