# WAF Bypass Testing — QuantScreen

## 1. Objective
Test the effectiveness of the WAF (Cloudflare/AWS WAF/ModSecurity) by attempting to bypass its rules using common evasion techniques.

## 2. Tools
- Burp Suite Professional/Community
- OWASP ZAP (with active scan)
- Custom scripts (python, curl)

## 3. Bypass Techniques

### 3.1 SQL Injection Evasion
| Technique | Payload Example | Expected Block? | Status |
|-----------|-----------------|-----------------|--------|
| URL encoding | `%27%20OR%20%271%27%3D%271` | [ ] | [ ] |
| Double encoding | `%2527%2520OR%2520%25271%2527%253D%25271` | [ ] | [ ] |
| Unicode encoding | `%EF%BC%87%20OR%20%EF%BC%87%31%EF%BC%87%3D%EF%BC%87%31` | [ ] | [ ] |
| Comments | `' OR 1=1 --` | [ ] | [ ] |
| Case variation | `' oR 1=1 --` | [ ] | [ ] |
| Concatenation | `' OR '1'='1` | [ ] | [ ] |
| Boolean blind | `' AND SLEEP(5) --` | [ ] | [ ] |
| Time-based | `' OR SLEEP(10) --` | [ ] | [ ] |

### 3.2 XSS Evasion
| Technique | Payload Example | Expected Block? | Status |
|-----------|-----------------|-----------------|--------|
| Basic script tag | `<script>alert(1)</script>` | [ ] | [ ] |
| Event handler | `<img src=x onerror=alert(1)>` | [ ] | [ ] |
| Encoded | `&lt;script&gt;alert(1)&lt;/script&gt;` | [ ] | [ ] |
| Mixed case | `<ScRiPt>alert(1)</ScRiPt>` | [ ] | [ ] |
| SVG | `<svg/onload=alert(1)>` | [ ] | [ ] |
| Data URI | `<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">` | [ ] | [ ] |

### 3.3 SSRF Evasion
| Technique | Payload Example | Expected Block? | Status |
|-----------|-----------------|-----------------|--------|
| Localhost | `http://localhost:5000/admin` | [ ] | [ ] |
| 127.0.0.1 | `http://127.0.0.1:5000/admin` | [ ] | [ ] |
| Decimal encoding | `http://2130706433/admin` (127.0.0.1) | [ ] | [ ] |
| Hex encoding | `http://0x7f000001/admin` | [ ] | [ ] |
| DNS rebinding | `http://evil.com` (points to internal) | [ ] | [ ] |
| HTTP redirect | `http://redirector.com?url=http://127.0.0.1/admin` | [ ] | [ ] |

### 3.4 Protocol Smuggling
| Technique | Payload Example | Expected Block? | Status |
|-----------|-----------------|-----------------|--------|
| CRLF injection | `%0d%0aHost: evil.com` | [ ] | [ ] |
| Request smuggling | `Transfer-Encoding: chunked` (with malformed body) | [ ] | [ ] |

## 4. Testing Methodology
1. **Baseline:** Send clean requests to establish normal behavior
2. **Payload delivery:** Inject payloads in all parameters (GET, POST, JSON, headers)
3. **Monitor:** Check if WAF blocks the request (403/429/redirect) or allows it
4. **Log:** Record allowed bypasses
5. **Escalate:** If bypass is successful, report as a finding

## 5. WAF Rules to Validate
- [ ] SQL injection (OWASP CRS: 942100, 942110, 942120)
- [ ] XSS (OWASP CRS: 941100, 941110, 941120)
- [ ] SSRF (OWASP CRS: 930120, 931100)
- [ ] RCE (OWASP CRS: 932100, 932110)
- [ ] Path traversal (OWASP CRS: 930120)
- [ ] Protocol violations (OWASP CRS: 920100, 920200)

## 6. Reporting
- Any successful bypass must be reported with:
  - Payload used
  - Endpoint where it succeeded
  - Recommended fix (e.g., stricter input validation)

---
*Use OWASP CRS (Core Rule Set) as the baseline.*
*Last updated: 2026-09-04*