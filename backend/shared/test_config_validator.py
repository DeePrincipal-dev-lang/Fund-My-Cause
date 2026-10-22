"""Tests for configuration validator"""

import os
import pytest
from config_validator import (
    ConfigRule,
    ConfigValidator,
    require_env,
    get_optional_env,
    get_env_int,
    get_env_bool,
)


class TestConfigValidator:
    """Tests for ConfigValidator class"""

    def test_validate_required_env(self):
        """Test validation of required environment variables"""
        schema = {
            "database_url": ConfigRule(
                env="DATABASE_URL",
                required=True,
                description="PostgreSQL connection string",
            )
        }

        env = {"DATABASE_URL": "postgres://localhost/testdb"}
        validator = ConfigValidator(schema, env)
        config = validator.validate()

        assert config["database_url"] == "postgres://localhost/testdb"

    def test_missing_required_env(self):
        """Test error for missing required variables"""
        schema = {
            "api_key": ConfigRule(
                env="API_KEY",
                required=True,
                description="API authentication key",
            )
        }

        validator = ConfigValidator(schema, {})

        with pytest.raises(ValueError) as exc_info:
            validator.validate()

        assert "Missing required environment variable: API_KEY" in str(exc_info.value)

    def test_default_values(self):
        """Test that default values are used when variables are missing"""
        schema = {
            "log_level": ConfigRule(
                env="LOG_LEVEL",
                required=False,
                default="info",
            )
        }

        validator = ConfigValidator(schema, {})
        config = validator.validate()

        assert config["log_level"] == "info"

    def test_enum_validation(self):
        """Test enum value validation"""
        schema = {
            "env": ConfigRule(
                env="NODE_ENV",
                required=True,
                enum=["development", "staging", "production"],
            )
        }

        # Invalid value
        validator = ConfigValidator(schema, {"NODE_ENV": "invalid"})
        with pytest.raises(ValueError) as exc_info:
            validator.validate()
        assert "Invalid value for NODE_ENV" in str(exc_info.value)

        # Valid value
        validator = ConfigValidator(schema, {"NODE_ENV": "production"})
        config = validator.validate()
        assert config["env"] == "production"

    def test_custom_validation(self):
        """Test custom validation function"""
        def is_valid_port(value):
            try:
                port = int(value)
                return 1 <= port <= 65535
            except ValueError:
                return False

        schema = {
            "port": ConfigRule(
                env="PORT",
                required=True,
                validate=is_valid_port,
                description="Valid port number",
            )
        }

        # Invalid value
        validator = ConfigValidator(schema, {"PORT": "invalid"})
        with pytest.raises(ValueError):
            validator.validate()

        # Valid value
        validator = ConfigValidator(schema, {"PORT": "3000"})
        config = validator.validate()
        assert config["port"] == "3000"

    def test_type_conversion(self):
        """Test type conversion"""
        schema = {
            "port": ConfigRule(env="PORT", required=True, type_=int),
            "debug": ConfigRule(env="DEBUG", required=True, type_=bool),
        }

        env = {"PORT": "3000", "DEBUG": "true"}
        validator = ConfigValidator(schema, env)
        config = validator.validate()

        assert config["port"] == 3000
        assert isinstance(config["port"], int)
        assert config["debug"] is True


class TestRequireEnv:
    """Tests for require_env function"""

    def test_returns_value(self):
        """Test that require_env returns the environment variable"""
        os.environ["TEST_VAR"] = "test_value"
        value = require_env("TEST_VAR")
        assert value == "test_value"
        del os.environ["TEST_VAR"]

    def test_missing_variable(self):
        """Test error when variable is missing"""
        with pytest.raises(ValueError) as exc_info:
            require_env("NONEXISTENT_VAR_123")

        assert "Required environment variable missing" in str(exc_info.value)

    def test_enum_validation(self):
        """Test enum value validation"""
        os.environ["TEST_ENV"] = "invalid"

        with pytest.raises(ValueError) as exc_info:
            require_env("TEST_ENV", enum=["a", "b", "c"])

        assert "Invalid value for TEST_ENV" in str(exc_info.value)
        del os.environ["TEST_ENV"]


class TestGetOptionalEnv:
    """Tests for get_optional_env function"""

    def test_returns_value_if_set(self):
        """Test that it returns the value if set"""
        os.environ["OPTIONAL_TEST"] = "value123"
        value = get_optional_env("OPTIONAL_TEST")
        assert value == "value123"
        del os.environ["OPTIONAL_TEST"]

    def test_returns_default_if_not_set(self):
        """Test that it returns default if not set"""
        value = get_optional_env("NONEXISTENT_123", default="default_value")
        assert value == "default_value"

    def test_returns_none_if_not_set_and_no_default(self):
        """Test that it returns None if not set and no default"""
        value = get_optional_env("NONEXISTENT_456")
        assert value is None


class TestGetEnvInt:
    """Tests for get_env_int function"""

    def test_parses_integer(self):
        """Test parsing of integer values"""
        os.environ["TEST_INT"] = "42"
        value = get_env_int("TEST_INT")
        assert value == 42
        assert isinstance(value, int)
        del os.environ["TEST_INT"]

    def test_returns_default_if_not_set(self):
        """Test that it returns default if not set"""
        value = get_env_int("NONEXISTENT_INT", default=100)
        assert value == 100

    def test_invalid_integer(self):
        """Test error for non-numeric values"""
        os.environ["INVALID_INT"] = "not-a-number"

        with pytest.raises(ValueError) as exc_info:
            get_env_int("INVALID_INT")

        assert "Invalid integer value" in str(exc_info.value)
        del os.environ["INVALID_INT"]

    def test_minimum_value(self):
        """Test minimum value validation"""
        os.environ["SMALL_INT"] = "5"

        with pytest.raises(ValueError) as exc_info:
            get_env_int("SMALL_INT", min_value=10)

        assert "too small" in str(exc_info.value)
        del os.environ["SMALL_INT"]

    def test_maximum_value(self):
        """Test maximum value validation"""
        os.environ["LARGE_INT"] = "100"

        with pytest.raises(ValueError) as exc_info:
            get_env_int("LARGE_INT", max_value=50)

        assert "too large" in str(exc_info.value)
        del os.environ["LARGE_INT"]


class TestGetEnvBool:
    """Tests for get_env_bool function"""

    def test_parses_true_values(self):
        """Test parsing of true values"""
        for val in ["true", "1", "yes", "on", "TRUE", "YES"]:
            os.environ["BOOL_TEST"] = val
            assert get_env_bool("BOOL_TEST") is True
            del os.environ["BOOL_TEST"]

    def test_parses_false_values(self):
        """Test parsing of false values"""
        for val in ["false", "0", "no", "off", "FALSE", "NO"]:
            os.environ["BOOL_TEST"] = val
            assert get_env_bool("BOOL_TEST") is False
            del os.environ["BOOL_TEST"]

    def test_returns_default_if_not_set(self):
        """Test that it returns default if not set"""
        value = get_env_bool("NONEXISTENT_BOOL", default=True)
        assert value is True

    def test_invalid_boolean(self):
        """Test error for invalid boolean values"""
        os.environ["INVALID_BOOL"] = "maybe"

        with pytest.raises(ValueError) as exc_info:
            get_env_bool("INVALID_BOOL")

        assert "Invalid boolean value" in str(exc_info.value)
        del os.environ["INVALID_BOOL"]


class TestConfigValidatorEdgeCases:
    """Edge case tests for ConfigValidator covering missing fields, wrong types, and out-of-range values"""

    def test_missing_required_field_in_schema(self):
        """Test that missing required field raises error"""
        schema = {
            "api_key": ConfigRule(
                env="API_KEY",
                required=True,
                description="API key",
            ),
            "database_url": ConfigRule(
                env="DATABASE_URL",
                required=True,
                description="Database URL",
            ),
        }

        env = {"API_KEY": "key123"}
        validator = ConfigValidator(schema, env)

        with pytest.raises(ValueError) as exc_info:
            validator.validate()

        assert "DATABASE_URL" in str(exc_info.value)
        assert "Missing required" in str(exc_info.value)

    def test_multiple_missing_required_fields(self):
        """Test that all missing required fields are reported"""
        schema = {
            "field1": ConfigRule(env="FIELD1", required=True),
            "field2": ConfigRule(env="FIELD2", required=True),
            "field3": ConfigRule(env="FIELD3", required=True),
        }

        validator = ConfigValidator(schema, {})

        with pytest.raises(ValueError) as exc_info:
            validator.validate()

        error_msg = str(exc_info.value)
        assert "FIELD1" in error_msg
        assert "FIELD2" in error_msg
        assert "FIELD3" in error_msg

    def test_wrong_type_conversion_int(self):
        """Test error when integer conversion fails"""
        schema = {
            "port": ConfigRule(env="PORT", required=True, type_=int),
        }

        env = {"PORT": "not-a-number"}
        validator = ConfigValidator(schema, env)

        with pytest.raises(ValueError) as exc_info:
            validator.validate()

        assert "Failed to convert" in str(exc_info.value)
        assert "PORT" in str(exc_info.value)
        assert "int" in str(exc_info.value)

    def test_wrong_type_conversion_bool(self):
        """Test error when boolean conversion fails for invalid values"""
        schema = {
            "debug": ConfigRule(env="DEBUG", required=True, type_=bool),
        }

        env = {"DEBUG": "maybe"}
        validator = ConfigValidator(schema, env)

        with pytest.raises(ValueError) as exc_info:
            validator.validate()

        assert "Failed to convert" in str(exc_info.value)

    def test_out_of_range_min_value_int(self):
        """Test get_env_int with value below minimum"""
        os.environ["TEST_MIN"] = "5"

        with pytest.raises(ValueError) as exc_info:
            get_env_int("TEST_MIN", min_value=10)

        assert "too small" in str(exc_info.value)
        del os.environ["TEST_MIN"]

    def test_out_of_range_max_value_int(self):
        """Test get_env_int with value above maximum"""
        os.environ["TEST_MAX"] = "100"

        with pytest.raises(ValueError) as exc_info:
            get_env_int("TEST_MAX", max_value=50)

        assert "too large" in str(exc_info.value)
        del os.environ["TEST_MAX"]

    def test_required_int_missing_with_default(self):
        """Test that default overrides required=True when provided"""
        schema = {
            "port": ConfigRule(
                env="PORT",
                required=True,
                default=8080,
                type_=int,
            ),
        }

        validator = ConfigValidator(schema, {})
        config = validator.validate()

        assert config["port"] == 8080

    def test_backward_compatible_default_values(self):
        """Test backward compatibility with default values"""
        schema = {
            "log_level": ConfigRule(
                env="LOG_LEVEL",
                required=False,
                default="info",
            ),
            "port": ConfigRule(
                env="PORT",
                required=False,
                default=3000,
                type_=int,
            ),
            "debug_mode": ConfigRule(
                env="DEBUG_MODE",
                required=False,
                default=False,
                type_=bool,
            ),
        }

        validator = ConfigValidator(schema, {})
        config = validator.validate()

        assert config["log_level"] == "info"
        assert config["port"] == 3000
        assert config["debug_mode"] is False

    def test_enum_with_multiple_invalid_values(self):
        """Test that multiple invalid enum values all fail"""
        schema = {
            "env": ConfigRule(
                env="NODE_ENV",
                required=True,
                enum=["dev", "staging", "prod"],
            ),
            "log_level": ConfigRule(
                env="LOG_LEVEL",
                required=True,
                enum=["debug", "info", "warn", "error"],
            ),
        }

        env = {"NODE_ENV": "invalid", "LOG_LEVEL": "verbose"}
        validator = ConfigValidator(schema, env)

        with pytest.raises(ValueError) as exc_info:
            validator.validate()

        error_msg = str(exc_info.value)
        assert "NODE_ENV" in error_msg
        assert "LOG_LEVEL" in error_msg

    def test_custom_validation_function_rejection(self):
        """Test that custom validation functions can reject values"""
        def is_valid_email(value):
            return "@" in value and "." in value

        schema = {
            "email": ConfigRule(
                env="EMAIL",
                required=True,
                validate=is_valid_email,
            ),
        }

        validator = ConfigValidator(schema, {"EMAIL": "invalid-email"})

        with pytest.raises(ValueError) as exc_info:
            validator.validate()

        assert "EMAIL" in str(exc_info.value)
        assert "Invalid value" in str(exc_info.value)

    def test_int_boundaries_at_limits(self):
        """Test integer validation at exact boundary values"""
        os.environ["BOUNDARY_INT"] = "50"

        # At minimum boundary
        value = get_env_int("BOUNDARY_INT", min_value=50)
        assert value == 50

        # At maximum boundary
        value = get_env_int("BOUNDARY_INT", max_value=50)
        assert value == 50

        # Both at boundaries
        value = get_env_int("BOUNDARY_INT", min_value=50, max_value=50)
        assert value == 50

        del os.environ["BOUNDARY_INT"]

    def test_required_with_empty_string_value(self):
        """Test that empty string is treated as missing for required fields"""
        schema = {
            "api_key": ConfigRule(
                env="API_KEY",
                required=True,
            ),
        }

        env = {"API_KEY": ""}
        validator = ConfigValidator(schema, env)

        with pytest.raises(ValueError) as exc_info:
            validator.validate()

        assert "Missing required" in str(exc_info.value)

    def test_optional_field_with_whitespace_value(self):
        """Test that whitespace-only values are handled correctly"""
        os.environ["OPTIONAL_WS"] = "   "

        # get_optional_env strips whitespace, so empty string is treated as not set
        value = get_optional_env("OPTIONAL_WS", default="default")
        assert value == "default"

        del os.environ["OPTIONAL_WS"]

    def test_type_conversion_priority_order(self):
        """Test that type conversion happens after validation"""
        schema = {
            "count": ConfigRule(
                env="COUNT",
                required=True,
                type_=int,
                validate=lambda x: int(x) > 0,
            ),
        }

        # Should fail validation before type conversion
        env = {"COUNT": "-5"}
        validator = ConfigValidator(schema, env)

        with pytest.raises(ValueError):
            validator.validate()

    def test_schema_with_mixed_required_and_optional(self):
        """Test schema with both required and optional fields"""
        schema = {
            "required_field": ConfigRule(
                env="REQUIRED",
                required=True,
            ),
            "optional_field": ConfigRule(
                env="OPTIONAL",
                required=False,
                default="default_value",
            ),
        }

        env = {"REQUIRED": "value"}
        validator = ConfigValidator(schema, env)
        config = validator.validate()

        assert config["required_field"] == "value"
        assert config["optional_field"] == "default_value"
