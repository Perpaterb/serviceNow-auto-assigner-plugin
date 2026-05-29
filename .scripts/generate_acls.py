#!/usr/bin/env python3
"""
Generate ServiceNow ACL XML for the auto-assigner tables.

v1 ACL policy (per the "minimal role-based" decision):
- For each table: write / create / delete require the
  `x_1578378_aa.queue_manager` role.
- Read is left open (table sys_db_object has read_access=true and no
  restrictive read ACL).

Produces, for each table-operation pair:
  - update/sys_security_acl_<sys_id>.xml      (the ACL rule)
  - update/sys_security_acl_role_<sys_id>.xml (links ACL to the role)

sys_ids are deterministic md5 hashes of stable keys.
"""
from __future__ import annotations
import hashlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "7d223776834583509c075cc0deaad308"
APP_SYS_ID = "7d223776834583509c075cc0deaad308"
SCOPE = "x_1578378_aa"

ROLE_NAME = f"{SCOPE}.queue_manager"
ROLE_SYS_ID = "86223776834583509c075cc0deaad3c2"

TIMESTAMP = "2026-05-28 13:30:00"

TABLES = [
    "assigner",
    "shift",
    "shift_break",
    "roster_entry",
    "ticket_type_selection",
    "reassign_type_selection",
    "reassign_state_selection",
    "activity_log",
]
OPERATIONS = ["write", "create", "delete"]


def sys_id(key: str) -> str:
    return hashlib.md5(f"{SCOPE}|{key}".encode()).hexdigest()


def scope_lines(indent: str = "        ") -> str:
    return (
        f'{indent}<sys_package display_value="Auto Assigner" source="{SCOPE}">{APP_SYS_ID}</sys_package>\n'
        f"{indent}<sys_policy/>\n"
        f'{indent}<sys_scope display_value="Auto Assigner">{APP_SYS_ID}</sys_scope>\n'
    )


def render_acl(table: str, operation: str) -> tuple[str, str]:
    full_name = f"{SCOPE}_{table}"
    acl_sys_id = sys_id(f"acl:{full_name}:{operation}")
    xml = f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sys_security_acl">
    <sys_security_acl action="INSERT_OR_UPDATE">
        <active>true</active>
        <admin_overrides>true</admin_overrides>
        <advanced>false</advanced>
        <applies_to/>
        <condition/>
        <controlled_by_refs/>
        <decision_type>allow</decision_type>
        <description/>
        <local_or_existing>Existing</local_or_existing>
        <name>{full_name}</name>
        <operation display_value="{operation}">{operation}</operation>
        <script/>
        <security_attribute/>
        <sys_class_name>sys_security_acl</sys_class_name>
        <sys_created_by>admin</sys_created_by>
        <sys_created_on>{TIMESTAMP}</sys_created_on>
        <sys_id>{acl_sys_id}</sys_id>
        <sys_mod_count>0</sys_mod_count>
        <sys_name>{full_name}</sys_name>
{scope_lines()}        <sys_update_name>sys_security_acl_{acl_sys_id}</sys_update_name>
        <sys_updated_by>admin</sys_updated_by>
        <sys_updated_on>{TIMESTAMP}</sys_updated_on>
        <type display_value="record">record</type>
    </sys_security_acl>
</record_update>
"""
    return acl_sys_id, xml


def render_acl_role(table: str, operation: str, acl_sys_id: str) -> tuple[str, str]:
    full_name = f"{SCOPE}_{table}"
    link_sys_id = sys_id(f"acl_role:{full_name}:{operation}:{ROLE_NAME}")
    sys_name = f"{full_name}.{ROLE_NAME}"
    xml = f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sys_security_acl_role">
    <sys_security_acl_role action="INSERT_OR_UPDATE">
        <sys_class_name>sys_security_acl_role</sys_class_name>
        <sys_created_by>admin</sys_created_by>
        <sys_created_on>{TIMESTAMP}</sys_created_on>
        <sys_id>{link_sys_id}</sys_id>
        <sys_mod_count>0</sys_mod_count>
        <sys_name>{sys_name}</sys_name>
{scope_lines()}        <sys_security_acl display_value="{full_name}">{acl_sys_id}</sys_security_acl>
        <sys_update_name>sys_security_acl_role_{link_sys_id}</sys_update_name>
        <sys_updated_by>admin</sys_updated_by>
        <sys_updated_on>{TIMESTAMP}</sys_updated_on>
        <sys_user_role display_value="{ROLE_NAME}" name="{ROLE_NAME}">{ROLE_SYS_ID}</sys_user_role>
    </sys_security_acl_role>
</record_update>
"""
    return link_sys_id, xml


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def main():
    update_dir = APP_DIR / "update"
    update_dir.mkdir(parents=True, exist_ok=True)

    count = 0
    for table in TABLES:
        for operation in OPERATIONS:
            acl_sys_id, acl_xml = render_acl(table, operation)
            link_sys_id, link_xml = render_acl_role(table, operation, acl_sys_id)

            write(update_dir / f"sys_security_acl_{acl_sys_id}.xml", acl_xml)
            write(update_dir / f"sys_security_acl_role_{link_sys_id}.xml", link_xml)
            count += 2

    print(f"Generated {count} ACL files ({len(TABLES)} tables × {len(OPERATIONS)} ops × 2 records).")


if __name__ == "__main__":
    main()
