#!/usr/bin/env python3
"""
Wrap .scripts/engine.js into a sysauto_script XML record so Studio can
import it via Apply Remote Changes.

Reads:  .scripts/engine.js
Writes: 7d223776834583509c075cc0deaad308/update/sysauto_script_<sys_id>.xml

The job is created with active=false so it does not fire until a manager
flips it on. Cadence: every 5 minutes (configurable via NF1 system
property in a later iteration).
"""
from __future__ import annotations
import hashlib
import html
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ENGINE_JS_PATH = REPO_ROOT / ".scripts" / "engine.js"
APP_DIR = REPO_ROOT / "7d223776834583509c075cc0deaad308"
APP_SYS_ID = "7d223776834583509c075cc0deaad308"
SCOPE = "x_1578378_aa"

JOB_NAME = "Auto-Assigner Engine"
JOB_SYS_ID = hashlib.md5(f"{SCOPE}|sysauto_script|engine".encode()).hexdigest()
TIMESTAMP = "2026-05-28 13:30:00"

# 5-minute cadence. sysauto_script.run_period is a Duration field stored
# as a datetime offset from 1970-01-01 00:00:00.
RUN_PERIOD = "1970-01-01 00:05:00"


def main():
    js = ENGINE_JS_PATH.read_text()
    # XML-encode any special chars in the script.
    js_xml = html.escape(js, quote=False)

    xml = f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sysauto_script">
    <sysauto_script action="INSERT_OR_UPDATE">
        <active>false</active>
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
        <run_period>{RUN_PERIOD}</run_period>
        <run_start/>
        <run_time>1970-01-01 00:00:00</run_time>
        <run_type>periodically</run_type>
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
    update_dir.mkdir(parents=True, exist_ok=True)
    out = update_dir / f"sysauto_script_{JOB_SYS_ID}.xml"
    out.write_text(xml)
    print(f"Wrote {out.relative_to(REPO_ROOT)} ({len(js)} chars of JS)")


if __name__ == "__main__":
    main()
