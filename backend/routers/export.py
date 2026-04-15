import os
import io
import zipfile
import subprocess
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
TMP_DIR = Path(__file__).parent.parent / "tmp"
OUTPUT_DIR = TMP_DIR / "output"


@router.get("/download/{filename}")
async def download_file(filename: str):
    path = OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        str(path),
        media_type="application/octet-stream",
        filename=filename,
    )


@router.get("/zip")
async def download_all_zip():
    """Zip all output files and stream as download."""
    files = list(OUTPUT_DIR.glob("*"))
    files = [f for f in files if f.is_file() and not f.name.endswith("_raw.*")]

    if not files:
        raise HTTPException(status_code=404, detail="No clips found to download")

    def generate_zip():
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in files:
                zf.write(f, f.name)
        buf.seek(0)
        yield from buf

    return StreamingResponse(
        generate_zip(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=viralclips.zip"},
    )


class OpenFolderRequest(BaseModel):
    path: str


@router.post("/open-folder")
async def open_output_folder(req: OpenFolderRequest):
    path = req.path if os.path.isdir(req.path) else str(OUTPUT_DIR)
    import platform
    try:
        if platform.system() == "Darwin":
            subprocess.Popen(["open", path])
        elif platform.system() == "Windows":
            subprocess.Popen(["explorer", path])
        else:
            subprocess.Popen(["xdg-open", path])
    except Exception:
        pass
    return {"opened": path}


@router.get("/list")
async def list_outputs():
    files = []
    for f in OUTPUT_DIR.glob("*"):
        if f.is_file() and "_raw" not in f.name:
            files.append({
                "name": f.name,
                "size_bytes": f.stat().st_size,
                "size_mb": round(f.stat().st_size / 1024 / 1024, 1),
                "url": f"/tmp/output/{f.name}",
                "path": str(f),
            })
    return {"files": files}
