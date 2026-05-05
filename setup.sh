#!/usr/bin/env bash
# ============================================================
#  PDF to Editable PowerPoint - macOS/Linux setup script
#  Creates .venv and installs deps.
# ============================================================
set -e

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
    echo "[ERROR] Python 3 not found."
    echo "Install Python 3.10+ first: https://www.python.org/downloads/"
    exit 1
fi

echo "=== Python ==="
python3 --version

if [ -d .venv ]; then
    echo "=== .venv exists, reusing ==="
else
    echo "=== Creating .venv ==="
    python3 -m venv .venv
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
