# EXPERIMENTAL / PARTIAL — Lumenva Local Runtime

Preserved from frozen source `339a19b49d1346bfb40fe09c8880b7b19513d04b`. This package is archival experimental work. It is not production-ready, is not wired into apps or workspace activation, and requires GitHub Actions validation before adoption.

The command runner and read-only executor are useful prototypes, not a security boundary. Review executable path resolution, environment handling, output redaction, local network probes, and filesystem race conditions before any production use. Do not pass untrusted commands or inputs to this runtime. MCG/Maestri gateway integration is out of scope.
