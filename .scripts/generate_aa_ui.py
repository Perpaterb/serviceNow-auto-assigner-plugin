#!/usr/bin/env python3
"""
Generate the Service Portal artifacts for the Auto-Assigner Main page.

Produces:
  - sp_widget         (aa-main)        — the widget itself
  - sp_page           (auto-assigner)  — the page record
  - sp_container                       — layout: one container per page
  - sp_row                             — one row in the container
  - sp_column                          — one column in the row
  - sp_instance                     — places aa-main inside the column

Source files read:
  .scripts/widgets/aa-main/template.html
  .scripts/widgets/aa-main/client.js
  .scripts/widgets/aa-main/server.js
  .scripts/widgets/aa-main/style.css

sys_ids are deterministic md5 hashes so re-running does not churn diffs.
"""
from __future__ import annotations
import hashlib
import html
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WIDGET_DIR = REPO_ROOT / ".scripts" / "widgets" / "aa-main"
APP_DIR = REPO_ROOT / "7d223776834583509c075cc0deaad308"
APP_SYS_ID = "7d223776834583509c075cc0deaad308"
SCOPE = "x_1578378_aa"
TIMESTAMP = "2026-05-29 04:00:00"

WIDGET_ID = "aa-main"
WIDGET_NAME = "Auto-Assigner Main"
PAGE_ID = "auto-assigner"
PAGE_TITLE = "ServiceNow Auto-Assigner"


def sys_id(key: str) -> str:
    return hashlib.md5(f"{SCOPE}|{key}".encode()).hexdigest()


def scope_lines(indent: str = "        ") -> str:
    return (
        f'{indent}<sys_package display_value="Auto Assigner" source="{SCOPE}">{APP_SYS_ID}</sys_package>\n'
        f"{indent}<sys_policy/>\n"
        f'{indent}<sys_scope display_value="Auto Assigner">{APP_SYS_ID}</sys_scope>\n'
    )


def audit_lines(rec_sys_id: str, update_name: str) -> str:
    return (
        f"        <sys_created_by>admin</sys_created_by>\n"
        f"        <sys_created_on>{TIMESTAMP}</sys_created_on>\n"
        f"        <sys_id>{rec_sys_id}</sys_id>\n"
        f"        <sys_mod_count>0</sys_mod_count>\n"
        f"        <sys_update_name>{update_name}</sys_update_name>\n"
        f"        <sys_updated_by>admin</sys_updated_by>\n"
        f"        <sys_updated_on>{TIMESTAMP}</sys_updated_on>\n"
    )


WIDGET_SYS_ID = sys_id(f"sp_widget:{WIDGET_ID}")
PAGE_SYS_ID = sys_id(f"sp_page:{PAGE_ID}")
CONTAINER_SYS_ID = sys_id(f"sp_container:{PAGE_ID}:1")
ROW_SYS_ID = sys_id(f"sp_row:{PAGE_ID}:1")
COLUMN_SYS_ID = sys_id(f"sp_column:{PAGE_ID}:1")
INSTANCE_SYS_ID = sys_id(f"sp_instance:{PAGE_ID}:{WIDGET_ID}")


def render_widget() -> str:
    tpl = html.escape(( WIDGET_DIR / "template.html").read_text(), quote=False)
    cli = html.escape(( WIDGET_DIR / "client.js"   ).read_text(), quote=False)
    srv = html.escape(( WIDGET_DIR / "server.js"   ).read_text(), quote=False)
    css = html.escape(( WIDGET_DIR / "style.css"   ).read_text(), quote=False)

    return f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sp_widget">
    <sp_widget action="INSERT_OR_UPDATE">
        <category>custom</category>
        <client_script>{cli}</client_script>
        <controller_as>c</controller_as>
        <css>{css}</css>
        <data_table>sp_instance</data_table>
        <demo_data/>
        <description>Manager UI for ServiceNow Auto-Assigner: tabs of assigners, status, Start/Stop, roster lists.</description>
        <docs/>
        <field_list/>
        <has_preview>false</has_preview>
        <id>{WIDGET_ID}</id>
        <internal>false</internal>
        <link/>
        <name>{WIDGET_NAME}</name>
        <option_schema/>
        <public>false</public>
        <roles/>
        <script>{srv}</script>
        <servicenow>false</servicenow>
        <sys_class_name>sp_widget</sys_class_name>
{audit_lines(WIDGET_SYS_ID, f"sp_widget_{WIDGET_SYS_ID}")}        <sys_name>{WIDGET_NAME}</sys_name>
{scope_lines()}        <template>{tpl}</template>
    </sp_widget>
</record_update>
"""


def render_page() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sp_page">
    <sp_page action="INSERT_OR_UPDATE">
        <category/>
        <css/>
        <draft>false</draft>
        <human_readable_url_path/>
        <id>{PAGE_ID}</id>
        <internal>false</internal>
        <omit_watcher>false</omit_watcher>
        <public>false</public>
        <roles/>
        <sys_class_name>sp_page</sys_class_name>
{audit_lines(PAGE_SYS_ID, f"sp_page_{PAGE_SYS_ID}")}        <sys_name>{PAGE_TITLE}</sys_name>
{scope_lines()}        <title>{PAGE_TITLE}</title>
        <use_seo_script>false</use_seo_script>
    </sp_page>
</record_update>
"""


def render_container() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sp_container">
    <sp_container action="INSERT_OR_UPDATE">
        <background_color/>
        <background_image/>
        <background_style/>
        <bootstrap_alt>false</bootstrap_alt>
        <container_fluid>false</container_fluid>
        <css_class/>
        <html_id/>
        <move_id/>
        <name>Main container</name>
        <order>100</order>
        <screen_size_xs>true</screen_size_xs>
        <screen_size_sm>true</screen_size_sm>
        <screen_size_md>true</screen_size_md>
        <screen_size_lg>true</screen_size_lg>
        <sp_page display_value="{PAGE_TITLE}">{PAGE_SYS_ID}</sp_page>
        <subheader>false</subheader>
        <sys_class_name>sp_container</sys_class_name>
{audit_lines(CONTAINER_SYS_ID, f"sp_container_{CONTAINER_SYS_ID}")}        <sys_name>Main container</sys_name>
{scope_lines()}        <width/>
    </sp_container>
</record_update>
"""


def render_row() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sp_row">
    <sp_row action="INSERT_OR_UPDATE">
        <css_class/>
        <move_id/>
        <order>100</order>
        <screen_size_xs>true</screen_size_xs>
        <screen_size_sm>true</screen_size_sm>
        <screen_size_md>true</screen_size_md>
        <screen_size_lg>true</screen_size_lg>
        <sp_container display_value="Main container">{CONTAINER_SYS_ID}</sp_container>
        <sys_class_name>sp_row</sys_class_name>
{audit_lines(ROW_SYS_ID, f"sp_row_{ROW_SYS_ID}")}{scope_lines()}    </sp_row>
</record_update>
"""


def render_column() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sp_column">
    <sp_column action="INSERT_OR_UPDATE">
        <css_class/>
        <move_id/>
        <order>100</order>
        <screen_size_xs>12</screen_size_xs>
        <screen_size_sm>12</screen_size_sm>
        <screen_size_md>12</screen_size_md>
        <screen_size_lg>12</screen_size_lg>
        <semantic_tag/>
        <size>12</size>
        <sp_row display_value="">{ROW_SYS_ID}</sp_row>
        <sys_class_name>sp_column</sys_class_name>
{audit_lines(COLUMN_SYS_ID, f"sp_column_{COLUMN_SYS_ID}")}{scope_lines()}    </sp_column>
</record_update>
"""


def render_instance() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?><record_update table="sp_instance">
    <sp_instance action="INSERT_OR_UPDATE">
        <active>true</active>
        <bootstrap_alt>false</bootstrap_alt>
        <css_class/>
        <id/>
        <order>100</order>
        <screen_size_xs>true</screen_size_xs>
        <screen_size_sm>true</screen_size_sm>
        <screen_size_md>true</screen_size_md>
        <screen_size_lg>true</screen_size_lg>
        <short_description/>
        <sp_column display_value="">{COLUMN_SYS_ID}</sp_column>
        <sp_widget display_value="{WIDGET_NAME}">{WIDGET_SYS_ID}</sp_widget>
        <sys_class_name>sp_instance</sys_class_name>
{audit_lines(INSTANCE_SYS_ID, f"sp_instance_{INSTANCE_SYS_ID}")}        <sys_name>{WIDGET_NAME}</sys_name>
{scope_lines()}        <title/>
        <widget_parameters/>
    </sp_instance>
</record_update>
"""


def main():
    update_dir = APP_DIR / "update"
    update_dir.mkdir(parents=True, exist_ok=True)

    files = {
        f"sp_widget_{WIDGET_SYS_ID}.xml":      render_widget(),
        f"sp_page_{PAGE_SYS_ID}.xml":          render_page(),
        f"sp_container_{CONTAINER_SYS_ID}.xml": render_container(),
        f"sp_row_{ROW_SYS_ID}.xml":            render_row(),
        f"sp_column_{COLUMN_SYS_ID}.xml":      render_column(),
        f"sp_instance_{INSTANCE_SYS_ID}.xml": render_instance(),
    }
    for fname, content in files.items():
        out = update_dir / fname
        out.write_text(content)
        print(f"Wrote {out.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
