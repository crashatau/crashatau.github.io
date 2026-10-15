# Physics sandbox

Run the game with Python 3 (no extra packages required):

```sh
python3 serve.py
```

Open <http://localhost:8000> on this computer. On another device on the same
network, open `http://<server-LAN-IP>:8000`. On Linux, `hostname -I` lists this
computer's addresses; use the address for your LAN connection. Allow incoming
TCP port 8000 in your firewall if needed. Keep the terminal open while playing;
press Ctrl+C to stop the server.

Choose another port or restrict access to this computer:

```sh
python3 serve.py --port 8080
python3 serve.py --bind 127.0.0.1
```

The launcher serves the project folder even when started from another directory.
Python's development server is intended for a trusted local network. Files in
this folder are accessible to connected clients, so keep private files elsewhere.

For a future GitHub Pages deployment, the game already uses relative asset paths.
Publish `index.html`, `style.css`, `script.js`, and any game data/assets; no build
step or Python server is needed there.
