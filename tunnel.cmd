@echo off
rem Phone testing: "tunnel" to start, "tunnel url" for the links, "tunnel stop" to stop. See dev-tunnel.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-tunnel.ps1" %*
