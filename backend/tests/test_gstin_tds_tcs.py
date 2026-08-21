"""Regression tests for the GSTIN validator.

Root-cause fix for the LIVE production complaint:
  Customer GSTIN 20AAAGC0935R1DS (CANTONMENT BOARD RAMGARH, Jharkhand,
  registered as a Tax Deductor) was being rejected as
  'GSTIN format is invalid'. The old regex forced position 14 = 'Z', but
  Tax Deductors carry 'D' and Tax Collectors 'C' at that position.
  See GSTN spec for GSTIN format.
"""
import pytest
from server import validate_gstin_format, _validate_gstin_for_party
from fastapi import HTTPException


class TestGstinValidator:
    def test_regular_gstin_accepted(self):
        # Standard company / GSTN sample.
        assert validate_gstin_format("29ABCDE1234F1Z5") is True

    def test_tax_deductor_gstin_accepted(self):
        # THE production bug — must accept 'D' at position 14.
        assert validate_gstin_format("20AAAGC0935R1DS") is True

    def test_tax_collector_gstin_accepted(self):
        # Position 14 = 'C' is a Tax Collector (TCS).
        assert validate_gstin_format("29ABCDE1234F1C5") is True

    def test_lowercase_normalised(self):
        assert validate_gstin_format("20aaagc0935r1ds") is True

    def test_short_gstin_rejected(self):
        assert validate_gstin_format("ABCDE12345") is False

    def test_wrong_pos14_letter_rejected(self):
        # Letter that is NOT Z/D/C must still be rejected — we didn't weaken the check.
        assert validate_gstin_format("29ABCDE1234F1X5") is False

    def test_bad_state_code_rejected(self):
        # Position 1-2 must be digits.
        assert validate_gstin_format("AAABCDE1234F1Z5") is False

    def test_empty_rejected(self):
        assert validate_gstin_format("") is False
        assert validate_gstin_format(None) is False  # type: ignore[arg-type]


class TestPartyValidator:
    def test_tds_party_accepts_ramgarh_gstin(self):
        # Must not raise.
        _validate_gstin_for_party("20AAAGC0935R1DS", "tax_deductor")

    def test_tcs_party_accepts_tcs_gstin(self):
        _validate_gstin_for_party("29ABCDE1234F1C5", "tax_collector")

    def test_regular_party_still_requires_gstin(self):
        with pytest.raises(HTTPException) as e:
            _validate_gstin_for_party("", "regular")
        assert e.value.status_code == 400

    def test_regular_party_rejects_malformed_gstin(self):
        with pytest.raises(HTTPException) as e:
            _validate_gstin_for_party("29ABCDE1234F1X5", "regular")
        assert e.value.status_code == 400

    def test_unregistered_allows_empty(self):
        _validate_gstin_for_party("", "unregistered")

    def test_unregistered_still_validates_supplied_gstin(self):
        with pytest.raises(HTTPException):
            _validate_gstin_for_party("BOGUS", "unregistered")
