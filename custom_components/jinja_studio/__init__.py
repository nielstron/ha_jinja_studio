"""Blockly template editor with persistent projects and native HA rendering."""

from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.helpers.storage import Store

DOMAIN = "jinja_studio"
PANEL = "jinja-studio"
MODULE_URL = "/jinja_studio_static/tools-tab.js?v=0.1.1"


async def async_setup_entry(hass, entry):
    """Register the editor and its project storage."""
    if DOMAIN not in hass.data:
        store = Store(hass, 1, DOMAIN)
        hass.data[DOMAIN] = {
            "store": store,
            "projects": await store.async_load() or {},
        }
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    "/jinja_studio_static",
                    str(Path(__file__).parent / "frontend"),
                    False,
                )
            ]
        )
        websocket_api.async_register_command(hass, websocket_projects)
    await panel_custom.async_register_panel(
        hass,
        PANEL,
        "jinja-studio-panel",
        sidebar_title=None,
        sidebar_icon="mdi:puzzle-outline",
        module_url="/jinja_studio_static/panel.js?v=0.1.1",
        require_admin=True,
    )
    frontend.add_extra_js_url(hass, MODULE_URL)
    return True


async def async_unload_entry(hass, entry):
    """Remove the panel; retain saved projects and registered API handlers."""
    frontend.async_remove_panel(hass, PANEL)
    frontend.remove_extra_js_url(hass, MODULE_URL)
    return True


@websocket_api.websocket_command(
    {
        vol.Required("type"): "jinja_studio/projects",
        vol.Required("action"): vol.In(["list", "save", "delete"]),
        vol.Optional("project_id"): str,
        vol.Optional("project"): {
            vol.Required("name"): vol.All(str, vol.Length(min=1, max=120)),
            vol.Required("workspace"): dict,
            vol.Required("template"): str,
        },
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_projects(hass, connection, msg):
    """Read and edit explicitly saved Blockly workspaces."""
    data = hass.data[DOMAIN]
    projects = data["projects"]
    action = msg["action"]
    if action == "save":
        projects[msg["project_id"]] = msg["project"]
        await data["store"].async_save(projects)
    elif action == "delete":
        del projects[msg["project_id"]]
        await data["store"].async_save(projects)
    connection.send_result(msg["id"], projects)
