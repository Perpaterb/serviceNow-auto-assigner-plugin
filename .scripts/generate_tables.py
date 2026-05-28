#!/usr/bin/env python3
"""
Generate ServiceNow source-control XML for the auto-assigner tables.

Produces, for each table:
  - update/sys_db_object_<sys_id>.xml          (the table record)
  - dictionary/<table>.xml                     (compact table-level entry)
  - update/sys_dictionary_<table>_null.xml     (table collection record)
  - update/sys_documentation_<table>__en.xml   (table label translation)
  - update/sys_dictionary_<table>_<column>.xml (one per column)

sys_ids are deterministic md5 hashes of stable keys so re-running the
generator does not duplicate records.

Run from the repo root:
  python3 .scripts/generate_tables.py
"""
from __future__ import annotations
import hashlib
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "7d223776834583509c075cc0deaad308"
APP_SYS_ID = "7d223776834583509c075cc0deaad308"
SCOPE = "x_1578378_aa"

# Stable timestamps so re-running the generator does not churn diffs.
TIMESTAMP = "2026-05-28 13:30:00"


def sys_id(key: str) -> str:
    """Deterministic 32-char hex sys_id derived from a stable key."""
    return hashlib.md5(f"{SCOPE}|{key}".encode()).hexdigest()


# ---------------------------------------------------------------------------
# Table + column definitions. Keep aligned with DATA_MODEL.md.
# ---------------------------------------------------------------------------

# Each column: (element, label, type, ref_table_or_max_length, default, mandatory)
# type is one of: string, reference, boolean, glide_time, glide_date_time
# For string: 4th value is max_length (int).
# For reference: 4th value is target table name (string).
# For boolean / time / date_time: 4th value is None.

TABLES = [
    {
        "name": "assigner",
        "label": "Assigner",
        "plural": "Assigners",
        "columns": [
            ("name", "Name", "string", 100, "", False),
            ("assignment_group", "Assignment group", "reference", "sys_user_group", "", False),
            ("running", "Running", "boolean", None, "false", False),
            ("run_start_time", "Run start time", "glide_time", None, "", False),
            ("run_end_time", "Run end time", "glide_time", None, "", False),
            ("stop_overnight", "Stop overnight", "boolean", None, "false", False),
            ("reassign_responded", "Reassign responded", "boolean", None, "false", False),
            ("reassign_state_in_progress", "Reassign: In Progress", "boolean", None, "false", False),
            ("reassign_state_new", "Reassign: New", "boolean", None, "false", False),
            ("reassign_state_onhold_to_inprogress", "Reassign: On Hold to In Progress", "boolean", None, "false", False),
            ("last_run", "Last run", "glide_date_time", None, "", False),
        ],
    },
    {
        "name": "shift",
        "label": "Shift",
        "plural": "Shifts",
        "columns": [
            ("name", "Name", "string", 100, "", False),
            ("assigner", "Assigner", "reference", f"{SCOPE}_assigner", "", False),
            ("start_time", "Start time", "glide_time", None, "", False),
            ("end_time", "End time", "glide_time", None, "", False),
            ("is_default", "Is default", "boolean", None, "false", False),
        ],
    },
    {
        "name": "shift_break",
        "label": "Shift break",
        "plural": "Shift breaks",
        "columns": [
            ("shift", "Shift", "reference", f"{SCOPE}_shift", "", False),
            ("start_time", "Start time", "glide_time", None, "", False),
            ("end_time", "End time", "glide_time", None, "", False),
        ],
    },
    {
        "name": "roster_entry",
        "label": "Roster entry",
        "plural": "Roster entries",
        "columns": [
            ("assigner", "Assigner", "reference", f"{SCOPE}_assigner", "", False),
            ("analyst", "Analyst", "reference", "sys_user", "", False),
            ("active", "Active", "boolean", None, "true", False),
            ("working", "Working", "boolean", None, "false", False),
            ("shift", "Shift", "reference", f"{SCOPE}_shift", "", False),
            ("last_assigned_at", "Last assigned at", "glide_date_time", None, "", False),
            ("last_shift", "Last shift", "reference", f"{SCOPE}_shift", "", False),
        ],
    },
    {
        "name": "ticket_type_selection",
        "label": "Ticket type selection",
        "plural": "Ticket type selections",
        "columns": [
            ("assigner", "Assigner", "reference", f"{SCOPE}_assigner", "", False),
            ("table_name", "Table name", "string", 100, "", False),
            ("enabled", "Enabled", "boolean", None, "false", False),
        ],
    },
    {
        "name": "reassign_type_selection",
        "label": "Reassign type selection",
        "plural": "Reassign type selections",
        "columns": [
            ("assigner", "Assigner", "reference", f"{SCOPE}_assigner", "", False),
            ("table_name", "Table name", "string", 100, "", False),
            ("enabled", "Enabled", "boolean", None, "false", False),
        ],
    },
    {
        "name": "activity_log",
        "label": "Activity log",
        "plural": "Activity logs",
        "columns": [
            ("assigner", "Assigner", "reference", f"{SCOPE}_assigner", "", False),
            ("ticket_table", "Ticket table", "string", 100, "", False),
            ("ticket_number", "Ticket number", "string", 40, "", False),
            ("ticket_ref", "Ticket reference", "string", 32, "", False),  # sys_id reference as string
            ("action", "Action", "string", 40, "", False),  # 'assigned' / 'unassigned'
            ("analyst", "Analyst", "reference", "sys_user", "", False),
        ],
    },
]


def scope_attrs() -> str:
    return (
        f'        <sys_package display_value="Auto Assigner" source="{SCOPE}">{APP_SYS_ID}</sys_package>\n'
        f'        <sys_policy/>\n'
        f'        <sys_scope display_value="Auto Assigner">{APP_SYS_ID}</sys_scope>\n'
    )


def sys_audit_block(name: str, update_name: str) -> str:
    return (
        f"        <sys_created_by>admin</sys_created_by>\n"
        f"        <sys_created_on>{TIMESTAMP}</sys_created_on>\n"
        f"        <sys_id>{name}</sys_id>\n"
        f"        <sys_mod_count>0</sys_mod_count>\n"
    )


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def render_sys_db_object(table: dict) -> tuple[str, str]:
    full_name = f"{SCOPE}_{table['name']}"
    table_sys_id = sys_id(f"sys_db_object:{full_name}")
    label = table["label"]
    sys_name = " ".join(w.capitalize() for w in table["name"].split("_"))
    xml = f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sys_db_object">
    <sys_db_object action="INSERT_OR_UPDATE">
        <access/>
        <actions_access>true</actions_access>
        <alter_access>true</alter_access>
        <caller_access/>
        <client_scripts_access>true</client_scripts_access>
        <configuration_access>false</configuration_access>
        <create_access>true</create_access>
        <create_access_controls>false</create_access_controls>
        <delete_access>true</delete_access>
        <filter_extension/>
        <is_df_table>false</is_df_table>
        <is_extendable>false</is_extendable>
        <label>{label}</label>
        <live_feed_enabled>false</live_feed_enabled>
        <name>{full_name}</name>
        <number_ref/>
        <provider_class/>
        <read_access>true</read_access>
        <scriptable_table>false</scriptable_table>
        <super_class/>
        <sys_class_name>sys_db_object</sys_class_name>
        <sys_created_by>admin</sys_created_by>
        <sys_created_on>{TIMESTAMP}</sys_created_on>
        <sys_id>{table_sys_id}</sys_id>
        <sys_mod_count>0</sys_mod_count>
        <sys_name>{sys_name}</sys_name>
{scope_attrs()}        <sys_update_name>sys_db_object_{table_sys_id}</sys_update_name>
        <sys_updated_by>admin</sys_updated_by>
        <sys_updated_on>{TIMESTAMP}</sys_updated_on>
        <update_access>true</update_access>
        <user_role/>
        <ws_access>true</ws_access>
    </sys_db_object>
</record_update>
"""
    return table_sys_id, xml


def render_dictionary_folder_entry(table: dict, table_sys_id: str) -> str:
    full_name = f"{SCOPE}_{table['name']}"
    return f"""<?xml version="1.0" encoding="UTF-8"?><database>
    <element audit="true" db_object_id="{table_sys_id}" label="{table['label']}" max_length="40" name="{full_name}" type="collection"/>
</database>
"""


def render_sys_dictionary_collection(table: dict) -> str:
    full_name = f"{SCOPE}_{table['name']}"
    return f"""<?xml version="1.0" encoding="UTF-8"?><record_update>
    <sys_dictionary action="INSERT_OR_UPDATE" element="" table="{full_name}">
        <active>true</active>
        <array>false</array>
        <attributes/>
        <audit>true</audit>
        <calculation/>
        <choice>0</choice>
        <choice_field/>
        <choice_table/>
        <column_label/>
        <comments/>
        <create_roles/>
        <default_value/>
        <defaultsort/>
        <delete_roles/>
        <dependent/>
        <dependent_on_field/>
        <display>false</display>
        <dynamic_creation>false</dynamic_creation>
        <dynamic_creation_script/>
        <dynamic_default_value/>
        <dynamic_ref_qual/>
        <element/>
        <element_reference>false</element_reference>
        <foreign_database/>
        <formula/>
        <function_definition/>
        <function_field>false</function_field>
        <internal_type display_value="Collection">collection</internal_type>
        <mandatory>false</mandatory>
        <max_length>40</max_length>
        <name>{full_name}</name>
        <next_element/>
        <primary>false</primary>
        <read_only>false</read_only>
        <read_roles/>
        <reference/>
        <reference_cascade_rule/>
        <reference_floats>false</reference_floats>
        <reference_key/>
        <reference_qual/>
        <reference_qual_condition/>
        <reference_type/>
        <spell_check>false</spell_check>
        <staged>false</staged>
        <sys_class_name>sys_dictionary</sys_class_name>
        <sys_created_by>admin</sys_created_by>
        <sys_created_on>{TIMESTAMP}</sys_created_on>
        <sys_name>{full_name}</sys_name>
{scope_attrs()}        <sys_update_name>sys_dictionary_{full_name}_null</sys_update_name>
        <sys_updated_by>admin</sys_updated_by>
        <sys_updated_on>{TIMESTAMP}</sys_updated_on>
        <table_reference>false</table_reference>
        <text_index>false</text_index>
        <unique>false</unique>
        <use_dependent_field>false</use_dependent_field>
        <use_dynamic_default>false</use_dynamic_default>
        <use_reference_qualifier>simple</use_reference_qualifier>
        <virtual>false</virtual>
        <virtual_type>script</virtual_type>
        <widget/>
        <write_roles/>
        <xml_view>false</xml_view>
    </sys_dictionary>
</record_update>
"""


def render_sys_documentation_table(table: dict) -> str:
    full_name = f"{SCOPE}_{table['name']}"
    return f"""<?xml version="1.0" encoding="UTF-8"?><record_update>
    <sys_documentation element="" label="{table['label']}" language="en" table="{full_name}">
        <sys_documentation action="INSERT_OR_UPDATE">
            <element/>
            <help/>
            <hint/>
            <label>{table['label']}</label>
            <language>en</language>
            <name>{full_name}</name>
            <plural>{table['plural']}</plural>
            <sys_class_name>sys_documentation</sys_class_name>
            <sys_created_by>admin</sys_created_by>
            <sys_created_on>{TIMESTAMP}</sys_created_on>
            <sys_mod_count>0</sys_mod_count>
            <sys_name>{table['label']}</sys_name>
{scope_attrs()}            <sys_update_name>sys_documentation_{full_name}__en</sys_update_name>
            <sys_updated_by>admin</sys_updated_by>
            <sys_updated_on>{TIMESTAMP}</sys_updated_on>
            <url/>
            <url_target/>
        </sys_documentation>
    </sys_documentation>
</record_update>
"""


def render_sys_dictionary_column(table: dict, column: tuple) -> str:
    full_name = f"{SCOPE}_{table['name']}"
    element, label, ctype, extra, default, mandatory = column

    # Map our types to ServiceNow internal_type + display values.
    type_map = {
        "string":          ("String",     "string"),
        "reference":       ("Reference",  "reference"),
        "boolean":         ("True/False", "boolean"),
        "glide_time":      ("Time",       "glide_time"),
        "glide_date_time": ("Date/Time",  "glide_date_time"),
    }
    display_type, internal = type_map[ctype]

    if ctype == "string":
        max_length = str(extra)
        reference_attr = ""
    elif ctype == "reference":
        max_length = "32"
        reference_attr = extra  # target table name
    elif ctype == "boolean":
        max_length = "40"
        reference_attr = ""
    elif ctype == "glide_time":
        max_length = "40"
        reference_attr = ""
    elif ctype == "glide_date_time":
        max_length = "40"
        reference_attr = ""

    col_sys_id = sys_id(f"sys_dictionary:{full_name}:{element}")
    reference_line = (
        f'        <reference display_value="" name="{reference_attr}">{reference_attr}</reference>\n'
        if reference_attr
        else "        <reference/>\n"
    )
    default_line = f"        <default_value>{default}</default_value>\n" if default else "        <default_value/>\n"
    mandatory_str = "true" if mandatory else "false"

    return f"""<?xml version="1.0" encoding="UTF-8"?><record_update>
    <sys_dictionary action="INSERT_OR_UPDATE" element="{element}" table="{full_name}">
        <active>true</active>
        <array>false</array>
        <attributes/>
        <audit>true</audit>
        <calculation/>
        <choice>0</choice>
        <choice_field/>
        <choice_table/>
        <column_label>{label}</column_label>
        <comments/>
        <create_roles/>
{default_line}        <defaultsort/>
        <delete_roles/>
        <dependent/>
        <dependent_on_field/>
        <display>false</display>
        <dynamic_creation>false</dynamic_creation>
        <dynamic_creation_script/>
        <dynamic_default_value/>
        <dynamic_ref_qual/>
        <element>{element}</element>
        <element_reference>false</element_reference>
        <foreign_database/>
        <formula/>
        <function_definition/>
        <function_field>false</function_field>
        <internal_type display_value="{display_type}">{internal}</internal_type>
        <mandatory>{mandatory_str}</mandatory>
        <max_length>{max_length}</max_length>
        <name>{full_name}</name>
        <next_element/>
        <primary>false</primary>
        <read_only>false</read_only>
        <read_roles/>
{reference_line}        <reference_cascade_rule/>
        <reference_floats>false</reference_floats>
        <reference_key/>
        <reference_qual/>
        <reference_qual_condition/>
        <reference_type/>
        <spell_check>false</spell_check>
        <staged>false</staged>
        <sys_class_name>sys_dictionary</sys_class_name>
        <sys_created_by>admin</sys_created_by>
        <sys_created_on>{TIMESTAMP}</sys_created_on>
        <sys_id>{col_sys_id}</sys_id>
        <sys_mod_count>0</sys_mod_count>
        <sys_name>{full_name}</sys_name>
{scope_attrs()}        <sys_update_name>sys_dictionary_{full_name}_{element}</sys_update_name>
        <sys_updated_by>admin</sys_updated_by>
        <sys_updated_on>{TIMESTAMP}</sys_updated_on>
        <table_reference>false</table_reference>
        <text_index>false</text_index>
        <unique>false</unique>
        <use_dependent_field>false</use_dependent_field>
        <use_dynamic_default>false</use_dynamic_default>
        <use_reference_qualifier>simple</use_reference_qualifier>
        <virtual>false</virtual>
        <virtual_type>script</virtual_type>
        <widget/>
        <write_roles/>
        <xml_view>false</xml_view>
    </sys_dictionary>
</record_update>
"""


def main():
    update_dir = APP_DIR / "update"
    dictionary_dir = APP_DIR / "dictionary"
    update_dir.mkdir(parents=True, exist_ok=True)
    dictionary_dir.mkdir(parents=True, exist_ok=True)

    summary = []
    for table in TABLES:
        full_name = f"{SCOPE}_{table['name']}"
        table_sys_id, db_object_xml = render_sys_db_object(table)

        write(update_dir / f"sys_db_object_{table_sys_id}.xml", db_object_xml)
        write(dictionary_dir / f"{full_name}.xml", render_dictionary_folder_entry(table, table_sys_id))
        write(update_dir / f"sys_dictionary_{full_name}_null.xml", render_sys_dictionary_collection(table))
        write(update_dir / f"sys_documentation_{full_name}__en.xml", render_sys_documentation_table(table))

        for column in table["columns"]:
            element = column[0]
            write(update_dir / f"sys_dictionary_{full_name}_{element}.xml", render_sys_dictionary_column(table, column))

        summary.append((full_name, len(table["columns"])))

    print("Generated tables:")
    for name, n_cols in summary:
        print(f"  {name}: {n_cols} columns")


if __name__ == "__main__":
    main()
