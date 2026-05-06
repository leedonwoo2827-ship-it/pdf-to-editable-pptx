#!/usr/bin/env bash
# ============================================================
#  PDF to Editable PowerPoint - macOS/Linux setup script
#  Creates .venv and installs deps.
# ============================================================
set -e

cd "$(dirname "$0")"

# Pick a working Python 3.10 / 3.11 / 3.12 binary. Several deps in the
# conversion pipeline (easyocr's transitive deps, simple_lama_inpainting
# + torch combos) only have wheels for 3.10–3.12. Refuse to set up on
# unsupported versions instead of failing cryptically halfway through.
PY=""
for cand in python3.12 python3.11 python3.10 python3; do
    if command -v "$cand" >/dev/null 2>&1; then
        if "$cand" -c "import sys; sys.exit(0 if (3,10) <= sys.version_info < (3,13) else 1)" >/dev/null 2>&1; then
            PY="$cand"
            break
        fi
    fi
done

if [ -z "$PY" ]; then
    echo "[ERROR] No supported Python found on PATH."
    echo "        This project requires Python 3.10, 3.11, or 3.12."
    echo "        Install one (e.g. via your distro package manager,"
    echo "        pyenv, or https://www.python.org/downloads/) and"
    echo "        re-run setup.sh."
    exit 1
fi

echo "=== Python ==="
"$PY" --version

if [ -d .venv ]; then
    # Verify the existing venv is on a supported Python; otherwise tell
    # the user to delete it.
    if .venv/bin/python -c "import sys; sys.exit(0 if (3,10) <= sys.version_info < (3,13) else 1)" >/dev/null 2>&1; then
        echo "=== .venv exists with a supported Python, reusing ==="
    else
        echo "[ERROR] .venv exists but is on an unsupported Python."
        echo "        rm -rf .venv && bash setup.sh"
        exit 1
    fi
else
    echo "=== Creating .venv with $PY ==="
    "$PY" -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "=== Upgrading pip ==="
python -m pip install --upgrade pip

echo "=== Installing deps (~700 MB; 5-10 min) ==="
pip install -r requirements.txt

echo
echo "============================================================"
echo " Done. Run with:"
echo "     source .venv/bin/activate"
echo "     python app.py"
echo "============================================================"
