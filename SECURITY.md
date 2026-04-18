# Security Policy

## Reporting a Vulnerability

We take the security of PDF Toolbox seriously. Since all processing happens 100% client-side, our attack surface is limited, but we still want to hear about any potential issues.

If you discover a security vulnerability, please report it by emailing:

**security@placeholder.com** *(replace with actual contact)*

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

## What We Consider Security Issues

- XSS (Cross-Site Scripting) vulnerabilities
- Data leakage (user files being sent to external servers)
- CSP bypass
- Supply chain attacks (malicious dependencies)
- Privacy violations (unexpected tracking or data collection)

## What Is NOT a Security Issue

- General bugs or feature requests (use GitHub Issues)
- UI/UX issues
- Performance problems

## Response Timeline

We will acknowledge your report within **48 hours** and aim to provide a resolution within **30 days**.

## Security Best Practices

PDF Toolbox is designed with security in mind:
- **100% client-side processing** — your files never leave your device
- **Content Security Policy (CSP)** — restricts script/style sources
- **No server-side storage** — no database, no cloud storage
- **Open source** — anyone can audit the code
