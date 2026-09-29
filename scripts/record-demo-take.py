#!/usr/bin/env python3
"""
Records the full demo submission video for Dice Chess on Fire TV.
Captures directly from the Vega Virtual Device with live audio and 1080p video,
adds an on-screen badge watermark ("Vega Virtual Device on macOS"), and appends
a closing summary card.

Total duration: ~2 minutes 30 seconds (strictly < 3 minutes).
"""

import os
import subprocess
import sys
import time
from PIL import Image, ImageDraw, ImageFont

VVD_CLI = "/Users/jegors/.local/share/mise/shims/vvd"
VEGA_CLI = "/Users/jegors/vega/sdk/vega-sdk/main/0.24.12044/bin/vega"
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"

APP_PKG = "com.fortemate.dicechesstv"
APP_NAME = "com.fortemate.dicechesstv.main"

RECORD_SECONDS = 142
OUTRO_SECONDS = 8

def run(cmd, check=True):
    print(f"-> {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"Command failed with code {res.returncode}:\n{res.stderr}\n{res.stdout}")
        sys.exit(res.returncode)
    return res

def press(*keys, gap=0.55):
    cmd = [VVD_CLI, "press", *keys, "--gap", str(int(gap * 1000))]
    run(cmd)

def create_watermark(path="/tmp/watermark.png"):
    im = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    font = ImageFont.truetype(FONT_PATH, 20)

    badge_w = 340
    badge_h = 42
    badge_x = 1920 - badge_w - 54
    badge_y = 54

    draw.rounded_rectangle(
        [badge_x, badge_y, badge_x + badge_w, badge_y + badge_h],
        radius=12,
        fill=(14, 28, 40, 210),
        outline=(56, 189, 248, 180),
        width=1,
    )

    text = "Vega Virtual Device on macOS"
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    ty = badge_y + (badge_h - th) // 2 - 2

    # Green indicator dot
    dot_r = 4
    dot_x = badge_x + 18
    dot_y = badge_y + badge_h // 2
    draw.ellipse(
        [dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r],
        fill=(34, 197, 94, 240),
    )

    draw.text((badge_x + 32, ty), text, fill=(241, 245, 249, 240), font=font)
    im.save(path)
    print(f"Created watermark badge at {path}")

def create_outro_card(path="/tmp/outro.png"):
    outro = Image.new("RGBA", (1920, 1080), (18, 39, 55, 255))
    draw = ImageDraw.Draw(outro)

    font_title = ImageFont.truetype(FONT_PATH, 50)
    font_sub = ImageFont.truetype(FONT_PATH, 26)
    font_body = ImageFont.truetype(FONT_PATH, 24)
    font_link = ImageFont.truetype(FONT_PATH, 22)

    card_w = 1440
    card_h = 760
    cx0 = (1920 - card_w) // 2
    cy0 = (1080 - card_h) // 2

    draw.rounded_rectangle(
        [cx0, cy0, cx0 + card_w, cy0 + card_h],
        radius=24,
        fill=(14, 28, 40, 245),
        outline=(56, 189, 248, 150),
        width=2,
    )

    draw.text(
        (cx0 + 80, cy0 + 65),
        "Dice Chess for Amazon Fire TV",
        fill=(255, 255, 255),
        font=font_title,
    )
    draw.text(
        (cx0 + 80, cy0 + 135),
        "Built for couch play with pure native speed, D-pad ergonomics & adaptive music",
        fill=(148, 163, 184),
        font=font_sub,
    )

    draw.line(
        [cx0 + 80, cy0 + 190, cx0 + card_w - 80, cy0 + 190],
        fill=(51, 65, 85),
        width=2,
    )

    bullets = [
        "• Native Remote Navigation: Full D-pad control, smart piece jumping & unplayable dice dimming",
        "• Hotseat Board Turning: 180° smooth crossfade rotation for local multiplayer on one screen",
        "• 3 Distinct AI Opponents: Local evaluation with Rolly (easy), Grabby (medium) & Rampage (hard)",
        "• Interactive Tutorial & Rules: Step-by-step couch onboarding & comprehensive topic guide",
        "• 100% Offline & Reproducible: Built with React Native for TV on Vega Virtual Device (macOS)",
        "• Open Source Tooling: Developed @fortemate/vega-vvd-driver for automated TV testing",
    ]

    by = cy0 + 225
    for b in bullets:
        draw.text((cx0 + 80, by), b, fill=(226, 232, 240), font=font_body)
        by += 52

    draw.line(
        [cx0 + 80, cy0 + card_h - 95, cx0 + card_w - 80, cy0 + card_h - 95],
        fill=(51, 65, 85),
        width=2,
    )

    draw.text(
        (cx0 + 80, cy0 + card_h - 65),
        "Repository: https://github.com/fortemate/dicechess-tv",
        fill=(56, 189, 248),
        font=font_link,
    )

    lic_text = "Licence: AGPL-3.0-only · Hackathon 2026"
    lic_bbox = font_link.getbbox(lic_text)
    lic_w = lic_bbox[2] - lic_bbox[0]
    draw.text(
        (cx0 + card_w - 80 - lic_w, cy0 + card_h - 65),
        lic_text,
        fill=(148, 163, 184),
        font=font_link,
    )

    outro.save(path)
    print(f"Created outro card at {path}")

VDA_CLI = "/Users/jegors/vega/sdk/vega-sdk/main/0.24.12044/bin/tools/vda"

def main():
    print("=== Step 1: Generating graphics assets ===")
    create_watermark("/tmp/watermark.png")
    create_outro_card("/tmp/outro.png")

    print("\n=== Step 2: Preparing clean app launch ===")
    run([VEGA_CLI, "device", "terminate-app", "-a", APP_NAME], check=False)
    time.sleep(1.0)
    print("Wiping app data and cleanly reinstalling vpkg...")
    run([
        VDA_CLI, "shell",
        "vpm uninstall com.fortemate.dicechesstv && vpm install /tmp/dicechess-tv-native_aarch64.vpkg"
    ])
    time.sleep(1.0)
    run([VEGA_CLI, "device", "launch-app", "-a", APP_NAME])
    time.sleep(3.5)

    raw_video = "/tmp/demo-raw.mp4"
    if os.path.exists(raw_video):
        os.remove(raw_video)

    print(f"\n=== Step 3: Starting VVD recording ({RECORD_SECONDS}s) ===")
    rec_proc = subprocess.Popen(
        [VVD_CLI, "record", raw_video, "--seconds", str(RECORD_SECONDS), "--fps", "30"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    time.sleep(2.0)

    start_time = time.time()

    try:
        # --- SCENE 1: Home Screen & Settings (0:00 - 0:25) ---
        print("\n--- SCENE 1: Home & Settings ---")
        time.sleep(2.5)  # View Home menu
        print("Navigating to Settings...")
        # On fresh launch: [New hotseat, Play computer, How to play, Rules, Settings, About]
        # Settings is index 4 -> 4 'down' presses
        press("down", "down", "down", "down", "ok", gap=0.7)
        time.sleep(2.0)  # On Settings screen

        print("Highlighting settings rows & enabling board turn in hotseat...")
        press("down", gap=1.0)  # Music volume
        press("down", gap=1.0)  # Sound effects
        press("down", gap=1.0)  # Turn board in hotseat: off
        time.sleep(1.0)
        press("ok", gap=1.5)    # Toggle to 'Turn board in hotseat: on' (#120)
        time.sleep(2.0)         # Emphasize Turn board in hotseat: on
        print("Returning to Home...")
        press("back", gap=1.2)
        time.sleep(1.5)

        # --- SCENE 2: Hotseat Match - White Turn (0:20 - 0:45) ---
        print("\n--- SCENE 2: Hotseat Match - White Turn ---")
        print("Starting New hotseat game...")
        # Returning from Settings leaves focus on Settings (index 4). 4 'up' lands on New hotseat (index 0).
        press("up", "up", "up", "up", "ok", gap=0.6)
        time.sleep(2.0)  # View board layout, White to play

        print("White rolling 3 dice...")
        press("ok", gap=2.0)  # Dice tumble animation & sound

        print("White playing out turn moves...")
        press("ok", "ok", gap=0.8)  # Slide piece animation (move 1)
        time.sleep(0.8)
        press("ok", "ok", gap=0.8)  # Move 2 (if available)
        time.sleep(0.8)

        print("White passing turn to Black...")
        press("ok", gap=2.5)  # Pass turn -> Triggers board turning 180°!

        # --- SCENE 3: Board Turn & Black Turn (0:45 - 1:10) ---
        print("\n--- SCENE 3: Board Turning & Black Turn ---")
        time.sleep(2.0)  # Observe board turned 180° for Black with crossfade!

        print("Black rolling 3 dice...")
        press("ok", gap=2.0)  # Dice tumble animation

        print("Black playing out turn move...")
        press("ok", "ok", gap=0.8)  # Slide piece (move 1)
        time.sleep(1.2)

        print("Opening in-game menu and resigning...")
        press("back", gap=0.8)
        press("down", "ok", gap=0.8)  # Menu -> Resign
        press("down", "ok", gap=0.8)  # Confirm -> Yes
        time.sleep(1.5)  # View Resigned end state
        print("Returning to Home screen...")
        press("ok", gap=1.2)  # Return to Home from ended board
        time.sleep(1.2)

        # --- SCENE 4: Single Player / Play the Computer (1:10 - 1:45) ---
        print("\n--- SCENE 4: Single Player vs AI Bot ---")
        print("Opening Play the computer...")
        # On Home from ended hotseat: [New hotseat, Play computer, ...] -> 1 'down'
        press("down", "ok", gap=0.8)
        time.sleep(2.0)  # On Opponents screen

        print("Browsing opponent cards...")
        press("right", gap=1.4)  # Grabby
        press("right", gap=1.4)  # Rampage
        press("left", gap=1.2)   # Back to Grabby
        time.sleep(1.0)
        print("Selecting Grabby...")
        press("ok", gap=1.0)     # Colour selection
        time.sleep(1.0)
        print("Choosing White...")
        press("down", "ok", gap=1.2)  # White
        time.sleep(2.0)  # Vs Grabby board view

        print("White rolling vs Grabby...")
        press("ok", gap=2.0)
        print("White playing out turn vs Grabby...")
        press("ok", "ok", gap=0.8)
        time.sleep(0.8)
        press("ok", "ok", gap=0.8)
        time.sleep(0.8)
        press("ok", "ok", gap=0.8)
        time.sleep(0.8)
        print("White ending turn...")
        press("ok", gap=1.5)

        print("Observing Grabby AI evaluation and turn execution...")
        time.sleep(5.0)  # Watch Grabby roll, evaluate, and move!

        print("Leaving bot match for Home...")
        press("back", gap=1.0)
        press("down", "ok", gap=0.8)  # Resign
        press("down", "ok", gap=0.8)  # Yes
        time.sleep(1.5)
        # In bot match, ended overlay is Result: ['Rematch', 'Main menu']
        press("down", "ok", gap=1.2)  # Main menu -> Returns to Home
        time.sleep(1.5)

        # --- SCENE 5: Tutorial & Rules Reference (1:45 - 2:15) ---
        print("\n--- SCENE 5: Tutorial & Rules Guide ---")
        print("Opening How to play (Tutorial)...")
        # On Home: [New hotseat, Play computer, How to play, Rules, ...]
        # How to play is index 2 -> 2 'down' presses
        press("down", "down", "ok", gap=0.8)
        time.sleep(2.5)  # View Tutorial Lesson 1

        print("Performing tutorial move...")
        press("ok", "ok", gap=1.0)
        time.sleep(2.5)  # See lesson completed prompt

        print("Returning to Home...")
        press("back", gap=1.2)
        time.sleep(1.5)

        print("Opening Rules guide...")
        # On Home from tutorial, focus is at index 0. Rules is index 3 -> 3 'down' presses
        press("down", "down", "down", "ok", gap=0.8)
        time.sleep(2.5)  # View Rules screen

        print("Browsing rule topics...")
        press("down", gap=1.4)
        press("down", gap=1.4)
        press("down", gap=1.4)
        time.sleep(2.0)

        print("Returning to Home...")
        press("back", gap=1.2)
        time.sleep(2.0)

        elapsed = time.time() - start_time
        remaining = RECORD_SECONDS - elapsed
        if remaining > 0:
            print(f"Waiting {remaining:.1f}s for recording to finish cleanly...")
            time.sleep(remaining)

    finally:
        out, err = rec_proc.communicate()
        print(f"Recorder finished with code {rec_proc.returncode}")
        if out:
            print(f"Recorder stdout:\n{out}")
        if err:
            print(f"Recorder stderr:\n{err}")

    # Check raw video
    if not os.path.exists(raw_video):
        print(f"Error: {raw_video} was not generated!")
        sys.exit(1)

    print("\n=== Step 4: Applying watermark and outro ===")
    watermarked_video = "/tmp/demo-watermarked.mp4"
    outro_video = "/tmp/demo-outro.mp4"
    final_output = "dist/demo-video-1080p.mp4"
    os.makedirs("dist", exist_ok=True)

    # 1. Overlay watermark on raw video
    print("Overlaying watermark badge...")
    run([
        "ffmpeg", "-y",
        "-i", raw_video,
        "-i", "/tmp/watermark.png",
        "-filter_complex", "[0:v][1:v]overlay=0:0[v]",
        "-map", "[v]",
        "-map", "0:a",
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        watermarked_video,
    ])

    # 2. Create 8-second outro video with silent audio
    print(f"Creating {OUTRO_SECONDS}s outro video...")
    run([
        "ffmpeg", "-y",
        "-loop", "1",
        "-r", "30",
        "-t", str(OUTRO_SECONDS),
        "-i", "/tmp/outro.png",
        "-f", "lavfi",
        "-t", str(OUTRO_SECONDS),
        "-i", "anullsrc=r=44100:cl=stereo",
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        outro_video,
    ])

    # 3. Concatenate watermarked video and outro video
    print(f"Concatenating final submission video to {final_output}...")
    run([
        "ffmpeg", "-y",
        "-i", watermarked_video,
        "-i", outro_video,
        "-filter_complex", "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]",
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        final_output,
    ])

    print("\n=== Step 5: Validating final submission video ===")
    probe = run(["ffprobe", "-hide_banner", final_output])
    print(probe.stderr)

    size_mb = os.path.getsize(final_output) / (1024 * 1024)
    print(f"\nFinal Video Created Successfully!")
    print(f"Path: {os.path.abspath(final_output)}")
    print(f"Size: {size_mb:.2f} MB")

if __name__ == "__main__":
    main()
