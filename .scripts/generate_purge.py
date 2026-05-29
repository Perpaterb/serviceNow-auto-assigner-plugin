#!/usr/bin/env python3
"""
Wrap .scripts/purge.js into a sysauto_script XML record. Daily cadence
at 02:00 instance TZ. Deletes activity_log entries older than 7 days
(R8.2).
"""
from __future__ import annotations
import hashlib
import html
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
JS_PATH = REPO_ROOT / ".scripts" / "purge.js"
APP_DIR = REPO_ROOT / "7d223776834583509c075cc0deaad308"
APP_SYS_ID = "7d223776834583509c075cc0deaad308"
SCOPE = "x_1578378_aa"

JOB_NAME = "Auto-Assigner Activity Log Purge"
JOB_SYS_ID = hashlib.md5(f"{SCOPE}|sysauto_script|purge".encode()).hexdigest()
TIMESTAMP = "2026-05-29 03:00:00"


def main():
    js = JS_PATH.read_text()
    js_xml = html.escape(js, quote=False)

    xml = f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sysauto_script">
    <sysauto_script action="INSERT_OR_UPDATE">
        <active>true</active>
        <business_calendar/>
        <business_calendar_other/>
        <condition/>
        <conditional>false</conditional>
        <name>{JOB_NAME}</name>
        <next_action/>
        <offset/>
        <offset_type/>
        <priority>100</priority>
        <run_as/>
        <run_dayofmonth>1</run_dayofmonth>
        <run_dayofweek>1</run_dayofweek>
        <run_period/>
        <run_start/>
        <run_time>1970-01-01 02:00:00</run_time>
        <run_type>daily</run_type>
        <script>{js_xml}</script>
        <sys_class_name>sysauto_script</sys_class_name>
        <sys_created_by>admin</sys_created_by>
        <sys_created_on>{TIMESTAMP}</sys_created_on>
        <sys_id>{JOB_SYS_ID}</sys_id>
        <sys_mod_count>0</sys_mod_count>
        <sys_name>{JOB_NAME}</sys_name>
        <sys_package display_value="Auto Assigner" source="{SCOPE}">{APP_SYS_ID}</sys_package>
        <sys_policy/>
        <sys_scope display_value="Auto Assigner">{APP_SYS_ID}</sys_scope>
        <sys_update_name>sysauto_script_{JOB_SYS_ID}</sys_update_name>
        <sys_updated_by>admin</sys_updated_by>
        <sys_updated_on>{TIMESTAMP}</sys_updated_on>
        <time_zone/>
        <upgrade_safe>false</upgrade_safe>
    </sysauto_script>
</record_update>
"""

    update_dir = APP_DIR / "update"
    out = update_dir / f"sysauto_script_{JOB_SYS_ID}.xml"
    out.write_text(xml)
    print(f"Wrote {out.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
