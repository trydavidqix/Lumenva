# Asterisk-v2 build manifest

The binary is intentionally not stored in Git. Rebuild from the official
`asterisk-22.11.0.tar.gz` source with the following command sequence on the isolated prefix:

```bash
./configure --prefix=/opt/asterisk-v2 --with-jansson-bundled --with-pjproject-bundled
TERM=xterm menuselect/menuselect \
  --enable chan_websocket \
  --enable res_http_websocket \
  --enable app_record \
  menuselect.makeopts
make -j2
make install
make samples
```

The isolated `asterisk.conf` sets all runtime directories below `/opt/asterisk-v2/`. Validate
`rtp show settings`, the loaded WebSocket modules and the SIP listener on `5061` before starting
the application. Do not copy these files over `/etc/asterisk` while production is serving calls.
