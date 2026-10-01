"""Filter metadata reflects actual registered call signatures."""

import runpy
from pathlib import Path

from jinja2.sandbox import ImmutableSandboxedEnvironment

describe_filters = runpy.run_path(
    Path(__file__).resolve().parents[1]
    / "custom_components/jinja_studio/filter_catalog.py"
)["describe_filters"]


def test_builtin_signatures_hide_context_and_piped_value():
    catalog = describe_filters(ImmutableSandboxedEnvironment())
    filters = {item["name"]: item for item in catalog["filters"]}
    assert [p["name"] for p in filters["round"]["parameters"]] == [
        "precision",
        "method",
    ]
    assert filters["round"]["parameters"][0]["default"] == "0"
    assert [p["name"] for p in filters["join"]["parameters"]] == ["d", "attribute"]
    assert filters["map"]["parameters"] == []
    assert filters["map"]["variadic"] == ["VAR_POSITIONAL", "VAR_KEYWORD"]
    assert "equalto" in catalog["tests"]


def test_custom_filters_show_required_parameters_and_nonserializable_defaults():
    environment = ImmutableSandboxedEnvironment()

    def custom(value, required, *, optional=False, sentinel=object()):
        return value

    environment.filters["custom"] = custom
    item = next(
        f for f in describe_filters(environment)["filters"] if f["name"] == "custom"
    )
    assert item["parameters"] == [
        {"name": "required", "positional": False, "required": True},
        {
            "name": "optional",
            "positional": False,
            "required": False,
            "default": "false",
        },
        {
            "name": "sentinel",
            "positional": False,
            "required": False,
            "default": "omitted",
        },
    ]
