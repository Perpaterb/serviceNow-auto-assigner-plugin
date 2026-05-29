#!/usr/bin/env python3
"""
Wrap .scripts/seed_default_shift.js into a sys_script (Business Rule)
XML record. Fires after-insert on x_1578378_aa_assigner so every new
assigner gets a Default shift (09:00-17:00 + 12:30-13:30 break, R3.3).
"""
from __future__ import annotations
import hashlib
import html
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
JS_PATH = REPO_ROOT / ".scripts" / "seed_default_shift.js"
APP_DIR = REPO_ROOT / "7d223776834583509c075cc0deaad308"
APP_SYS_ID = "7d223776834583509c075cc0deaad308"
SCOPE = "x_1578378_aa"
TABLE = f"{SCOPE}_assigner"

BR_NAME = "Seed Default Shift on Assigner Insert"
BR_SYS_ID = hashlib.md5(f"{SCOPE}|sys_script|seed_default_shift".encode()).hexdigest()
TIMESTAMP = "2026-05-29 00:00:00"


def main():
    js = JS_PATH.read_text()
    js_xml = html.escape(js, quote=False)

    xml = f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sys_script">
    <sys_script action="INSERT_OR_UPDATE">
        <abort_action>false</abort_action>
        <access>package_private</access>
        <action_delete>false</action_delete>
        <action_insert>true</action_insert>
        <action_query>false</action_query>
        <action_update>false</action_update>
        <active>true</active>
        <add_message>false</add_message>
        <advanced>true</advanced>
        <change_fields>false</change_fields>
        <client_callable>false</client_callable>
        <collection>{TABLE}</collection>
        <condition/>
        <description>Creates a Default shift (09:00-17:00 with 12:30-13:30 break) for each new assigner.</description>
        <execute_function>false</execute_function>
        <filter_condition/>
        <is_rest>false</is_rest>
        <message/>
        <name>{BR_NAME}</name>
        <order>100</order>
        <priority>100</priority>
        <rest_method/>
        <rest_method_text/>
        <rest_service/>
        <rest_service_text/>
        <rest_variables/>
        <role_conditions/>
        <script>{js_xml}</script>
        <sys_class_name>sys_script</sys_class_name>
        <sys_created_by>admin</sys_created_by>
        <sys_created_on>{TIMESTAMP}</sys_created_on>
        <sys_domain>global</sys_domain>
        <sys_domain_path>/</sys_domain_path>
        <sys_id>{BR_SYS_ID}</sys_id>
        <sys_mod_count>0</sys_mod_count>
        <sys_name>{BR_NAME}</sys_name>
        <sys_package display_value="Auto Assigner" source="{SCOPE}">{APP_SYS_ID}</sys_package>
        <sys_policy/>
        <sys_scope display_value="Auto Assigner">{APP_SYS_ID}</sys_scope>
        <sys_update_name>sys_script_{BR_SYS_ID}</sys_update_name>
        <sys_updated_by>admin</sys_updated_by>
        <sys_updated_on>{TIMESTAMP}</sys_updated_on>
        <template/>
        <when>after</when>
    </sys_script>
</record_update>
"""

    update_dir = APP_DIR / "update"
    out = update_dir / f"sys_script_{BR_SYS_ID}.xml"
    out.write_text(xml)
    print(f"Wrote {out.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
