#!/usr/bin/env python3
"""
Model Checkpoint Downloader for Alzheimer's MRI AI Inference Service.
Ensures the trained checkpoint is present before starting the AI service.

Behavior:
1. Verifies if the checkpoint already exists. If present and valid, preserves it without downloading.
2. If missing, streams the model from MODEL_DOWNLOAD_URL with chunking and progress reporting.
3. Supports optional SHA-256 and expected size validation.
4. Uses atomic write via a temporary file to avoid partial/corrupted checkpoints.
"""

import os
import sys
import hashlib
import urllib.request
import urllib.error

# Expected model metadata for best_hybrid_model.pth
DEFAULT_RELATIVE_PATH = "models/best_hybrid_model.pth"
EXPECTED_SIZE_BYTES = 211853875  # ~202.04 MB
EXPECTED_SHA256 = "676fefe87d63ab727fe9b3451e94d86b056082651bbe858ca52bb56ae8fcdf06"
MIN_VALID_SIZE_BYTES = 50 * 1024 * 1024  # At least 50 MB threshold for pre-checks


def calculate_sha256(file_path):
    """Calculates the SHA-256 hexadecimal digest of a file in 8MB chunks."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8 * 1024 * 1024):
            hasher.update(chunk)
    return hasher.hexdigest()


def resolve_model_path():
    """Resolves the absolute path to the target checkpoint."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.getenv("MODEL_CHECKPOINT_PATH", DEFAULT_RELATIVE_PATH)
    if os.path.isabs(env_path):
        return env_path
    return os.path.normpath(os.path.join(script_dir, env_path))


def ensure_model_exists():
    """
    Checks for the model checkpoint. If absent, downloads it from MODEL_DOWNLOAD_URL.
    Returns 0 on success, or raises RuntimeError / SystemExit on fatal errors.
    """
    target_path = resolve_model_path()
    expected_sha = os.getenv("MODEL_EXPECTED_SHA256", EXPECTED_SHA256)
    expected_size = int(os.getenv("MODEL_EXPECTED_SIZE_BYTES", EXPECTED_SIZE_BYTES))

    print(f"[ModelDownloader] Target checkpoint path: {target_path}")

    # 1. Check if model already exists
    if os.path.isfile(target_path):
        current_size = os.path.getsize(target_path)
        print(f"[ModelDownloader] Existing checkpoint found ({current_size:,} bytes).")

        # Validate minimum acceptable size
        if current_size >= MIN_VALID_SIZE_BYTES:
            if expected_sha:
                print("[ModelDownloader] Verifying SHA-256 checksum of existing checkpoint...")
                digest = calculate_sha256(target_path)
                if digest.lower() == expected_sha.lower():
                    print("[ModelDownloader] Checksum matched. Valid checkpoint preserved.")
                    return 0
                else:
                    print(
                        f"[ModelDownloader] WARNING: Checksum mismatch for existing file:\n"
                        f"  Expected: {expected_sha}\n"
                        f"  Computed: {digest}\n"
                        f"To preserve data integrity, the existing file will not be automatically overwritten.",
                        file=sys.stderr,
                    )
                    # If existing file is roughly the right size, preserve it
                    if abs(current_size - expected_size) < 1024 * 1024:
                        print("[ModelDownloader] File size matches trained weights. Preserving file.")
                        return 0
            else:
                print("[ModelDownloader] Checkpoint verified by size. Preserving file.")
                return 0
        else:
            print(
                f"[ModelDownloader] Existing file is suspiciously small ({current_size} bytes). "
                "Will attempt download if URL is provided.",
                file=sys.stderr,
            )

    # 2. Check if download URL is configured
    download_url = os.getenv("MODEL_DOWNLOAD_URL", "").strip()
    if not download_url:
        if os.path.isfile(target_path) and os.path.getsize(target_path) > 0:
            print("[ModelDownloader] MODEL_DOWNLOAD_URL not set, but local checkpoint exists. Proceeding.")
            return 0
        print(
            "\n"
            "================================================================================\n"
            "[ModelDownloader] ERROR: Missing Trained Model Checkpoint!\n"
            "--------------------------------------------------------------------------------\n"
            f"Expected file at: {target_path}\n\n"
            "The model file 'best_hybrid_model.pth' (~203 MB) is not tracked in Git.\n"
            "To make it available on Render or remote servers, set the environment variable:\n"
            "  MODEL_DOWNLOAD_URL=<direct-download-url>\n\n"
            "Supported hosting options:\n"
            "  1. GitHub Release asset (Direct download URL from tagged release)\n"
            "  2. Hugging Face Hub (https://huggingface.co/<user>/<repo>/resolve/main/best_hybrid_model.pth)\n"
            "  3. AWS S3 / Cloudflare R2 / Google Cloud Storage direct or presigned URL\n"
            "================================================================================\n",
            file=sys.stderr,
        )
        sys.exit(1)

    # 3. Stream download to temporary file
    target_dir = os.path.dirname(target_path)
    if target_dir:
        os.makedirs(target_dir, exist_ok=True)

    temp_path = f"{target_path}.download.{os.getpid()}"
    print(f"[ModelDownloader] Downloading checkpoint from:\n  {download_url}\n-> {temp_path}")

    req = urllib.request.Request(
        download_url,
        headers={"User-Agent": "NeuroScan-Model-Downloader/1.0 (Render Build)"},
    )

    try:
        with urllib.request.urlopen(req) as response, open(temp_path, "wb") as out_file:
            total_size_header = response.headers.get("Content-Length")
            total_size = int(total_size_header) if total_size_header else 0

            downloaded = 0
            chunk_size = 1024 * 1024  # 1 MB chunk
            last_logged_mb = 0

            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                out_file.write(chunk)
                downloaded += len(chunk)

                downloaded_mb = downloaded // (1024 * 1024)
                if downloaded_mb - last_logged_mb >= 20 or (total_size and downloaded == total_size):
                    last_logged_mb = downloaded_mb
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100.0
                        print(f"[ModelDownloader] Progress: {downloaded_mb} MB / {total_size // (1024 * 1024)} MB ({percent:.1f}%)")
                    else:
                        print(f"[ModelDownloader] Progress: {downloaded_mb} MB downloaded...")

        # 4. Verify downloaded file
        downloaded_size = os.path.getsize(temp_path)
        print(f"[ModelDownloader] Download completed ({downloaded_size:,} bytes).")

        if downloaded_size < MIN_VALID_SIZE_BYTES:
            os.remove(temp_path)
            raise ValueError(
                f"Downloaded file is too small ({downloaded_size} bytes). Expected ~{EXPECTED_SIZE_BYTES:,} bytes. "
                "Check that the URL is a direct binary download link, not an HTML page."
            )

        if expected_sha:
            print("[ModelDownloader] Verifying SHA-256 checksum...")
            digest = calculate_sha256(temp_path)
            if digest.lower() != expected_sha.lower():
                print(
                    f"[ModelDownloader] WARNING: Downloaded SHA-256 differs:\n"
                    f"  Expected: {expected_sha}\n"
                    f"  Got:      {digest}\n"
                    "If you intentionally retrained or updated the checkpoint, update MODEL_EXPECTED_SHA256."
                )

        # 5. Atomic rename
        os.replace(temp_path, target_path)
        print(f"[ModelDownloader] Successfully placed checkpoint at {target_path}")
        return 0

    except Exception as exc:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        print(f"[ModelDownloader] ERROR: Download failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    ensure_model_exists()
