"""Describe registered Jinja filters without executing them."""

import inspect
import json


def describe_filters(environment):
    """Expose signatures and defaults from the actual template environment."""
    result = []
    for name, function in sorted(environment.filters.items()):
        parameters = []
        variadic = []
        try:
            signature = inspect.signature(function)
        except (TypeError, ValueError):
            signature = None
        if signature is not None:
            arguments = list(signature.parameters.values())
            if getattr(function, "jinja_pass_arg", None) is not None:
                arguments = arguments[1:]
            arguments = arguments[1:]  # The piped value is supplied by its block.
            for parameter in arguments:
                if parameter.kind in (
                    inspect.Parameter.VAR_POSITIONAL,
                    inspect.Parameter.VAR_KEYWORD,
                ):
                    variadic.append(parameter.kind.name)
                    continue
                item = {
                    "name": parameter.name,
                    "positional": parameter.kind == inspect.Parameter.POSITIONAL_ONLY,
                    "required": parameter.default is inspect.Parameter.empty,
                }
                if parameter.default is not inspect.Parameter.empty:
                    default = parameter.default
                    if (
                        isinstance(default, (str, int, float, bool, list, dict))
                        or default is None
                    ):
                        item["default"] = json.dumps(default)
                    else:
                        item["default"] = "omitted"
                parameters.append(item)
        documentation = inspect.getdoc(function) or ""
        result.append(
            {
                "name": name,
                "description": documentation.split("\n\n")[0],
                "parameters": parameters,
                "variadic": variadic,
            }
        )
    return {"filters": result, "tests": sorted(environment.tests)}
