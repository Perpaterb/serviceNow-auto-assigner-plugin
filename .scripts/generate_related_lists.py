#!/usr/bin/env python3
"""
Generate sys_ui_related (related list) XML for parent forms in the
auto-assigner app. Uses the format ServiceNow itself emits — captured
when we added the Shift Breaks related list to the Shift form by hand
and committed via Studio source control.

Currently produces:
- Assigner form: Shifts, Roster entries, Ticket type selections,
  Reassign type selections, Activity log.

The Shift form's "Shift Breaks" related list is already in the repo from
the original hand-config; this generator does not re-emit it.
"""
from __future__ import annotations
import hashlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "7d223776834583509c075cc0deaad308"
APP_SYS_ID = "7d223776834583509c075cc0deaad308"
SCOPE = "x_1578378_aa"
TIMESTAMP = "2026-05-29 03:00:00"

# Display label for each in-scope table.
TABLE_LABELS = {
    "assigner":                "Assigner",
    "shift":                   "Shift",
    "shift_break":             "Shift break",
    "roster_entry":            "Roster entry",
    "ticket_type_selection":   "Ticket type selection",
    "reassign_type_selection": "Reassign type selection",
    "activity_log":            "Activity log",
}

# Each parent form gets one container (sys_ui_related_list) and N entries
# (sys_ui_related_list_entry). Entries are (child_table_short, ref_field).
RELATIONS = {
    "assigner": [
        ("shift",                   "assigner"),
        ("roster_entry",            "assigner"),
        ("ticket_type_selection",   "assigner"),
        ("reassign_type_selection", "assigner"),
        ("activity_log",            "assigner"),
    ],
}


def sys_id(key: str) -> str:
    return hashlib.md5(f"{SCOPE}|{key}".encode()).hexdigest()


def render(parent_short: str, entries: list[tuple[str, str]]) -> tuple[str, str]:
    parent_full = f"{SCOPE}_{parent_short}"
    parent_label = TABLE_LABELS[parent_short]
    container_sys_id = sys_id(f"sys_ui_related_list:{parent_full}:default")

    entry_blocks = []
    for position, (child_short, ref_field) in enumerate(entries):
        child_full = f"{SCOPE}_{child_short}"
        related_spec = f"{child_full}.{ref_field}"
        entry_sys_id = sys_id(f"sys_ui_related_list_entry:{parent_full}:{related_spec}")
        entry_blocks.append(f"""        <sys_ui_related_list_entry action="INSERT_OR_UPDATE">
            <filter/>
            <list_id display_value="{parent_label} - Default view" name="{parent_full}" related_list="NULL" sys_domain="global" view="Default view">{container_sys_id}</list_id>
            <order_by/>
            <position>{position}</position>
            <related_list>{related_spec}</related_list>
            <sys_class_name>sys_ui_related_list_entry</sys_class_name>
            <sys_created_by>admin</sys_created_by>
            <sys_created_on>{TIMESTAMP}</sys_created_on>
            <sys_id>{entry_sys_id}</sys_id>
            <sys_mod_count>0</sys_mod_count>
            <sys_updated_by>admin</sys_updated_by>
            <sys_updated_on>{TIMESTAMP}</sys_updated_on>
        </sys_ui_related_list_entry>""")

    container_block = f"""        <sys_ui_related_list action="INSERT_OR_UPDATE">
            <calculated_name>{parent_label} - Default view</calculated_name>
            <filter/>
            <name>{parent_full}</name>
            <order_by/>
            <position/>
            <related_list/>
            <sys_class_name>sys_ui_related_list</sys_class_name>
            <sys_created_by>admin</sys_created_by>
            <sys_created_on>{TIMESTAMP}</sys_created_on>
            <sys_domain>global</sys_domain>
            <sys_domain_path>/</sys_domain_path>
            <sys_id>{container_sys_id}</sys_id>
            <sys_mod_count>0</sys_mod_count>
            <sys_name>{parent_label} - Default view</sys_name>
            <sys_package display_value="Auto Assigner" source="{SCOPE}">{APP_SYS_ID}</sys_package>
            <sys_policy/>
            <sys_scope display_value="Auto Assigner">{APP_SYS_ID}</sys_scope>
            <sys_update_name>sys_ui_related_{parent_full}_null</sys_update_name>
            <sys_updated_by>admin</sys_updated_by>
            <sys_updated_on>{TIMESTAMP}</sys_updated_on>
            <sys_user/>
            <view display_value="Default view" name="NULL">Default view</view>
            <view_name/>
        </sys_ui_related_list>"""

    entries_xml = "\n".join(entry_blocks)
    xml = f"""<?xml version="1.0" encoding="UTF-8"?><record_update>
    <sys_ui_related sys_domain="global" table="{parent_full}" version="2" view="">
{entries_xml}
{container_block}
    </sys_ui_related>
</record_update>
"""
    return parent_full, xml


def main():
    update_dir = APP_DIR / "update"
    update_dir.mkdir(parents=True, exist_ok=True)
    for parent_short, entries in RELATIONS.items():
        parent_full, xml = render(parent_short, entries)
        out = update_dir / f"sys_ui_related_{parent_full}_null.xml"
        out.write_text(xml)
        print(f"Wrote {out.relative_to(REPO_ROOT)} ({len(entries)} entries)")


if __name__ == "__main__":
    main()
