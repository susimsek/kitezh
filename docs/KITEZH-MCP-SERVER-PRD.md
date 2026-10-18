# Kitezh MCP Server PRD

**Durum:** P0 servis dağıtıldı ve temel OAuth/MCP akışı canlıda doğrulandı; aşağıdaki P0 güvenlik ve protokol kabul maddeleri tamamlanmadan ürün kabulü kapanmaz

**Tarih:** 17 Ekim 2026

**Kapsam:** Tek issuer kullanan Kitezh kurulumu

**Önerilen ilk sürüm:** Ayrı Render Web Service olarak çalışan uzak, salt okunur MCP sunucusu

**Uygulama notu (17 Ekim 2026):** İlk bağımsız `mcp/` modülü, salt okunur on araç, MCP resource audience ve `mcp.read`, protected resource metadata, RFC 8693 token exchange, ayrı Render servisi, CI kalite işi, tag bazlı yayın akışı, Sonar girdileri ve Grafana dashboard/alert dosyaları eklendi. MCP native build ve release akışı backend ile aynı GraalVM Native Image, UPX ve Jib Native Image extension yapısını kullanır; CI Linux AMD64 ve ARM64 native binary'lerini doğrular, mimariye özel imajları Docker Hub'a basar, multi-architecture manifest'i Render'a dağıtır ve `mcp/docs/README-dockerhub.md` açıklamasını günceller. Canlı testte önceden kayıtlı `mcp-client` ile Authorization Code + PKCE token alımı, MCP `initialize`, `tools/list` (10 araç) ve `kitezh_get_context` çağrısı başarılı oldu; yeni istemci kaydı oluşturulmadı. Test ayrıca kritik bir kapsam fazlası buldu: yalnız `openid mcp.read` istenmesine rağmen verilen token `admin-api` ve `roles` kapsamlarını da içerdi. Bu durum P0 güvenlik kabul maddesidir. Kullanılan Spring AI 2.0.1 / MCP Java SDK 2.0.0 bileşimi en fazla `2025-11-25` protokolünü destekliyor; 17 Ekim 2026 itibarıyla yayımlanmış `2026-07-28` belirtimi henüz karşılanmıyor. Aşağıdaki gap incelemesi, canlı gözlem ile depo kodunu ve resmi GitHub MCP Server / MCP belgelerini karşılaştırır.

**Güvenlik modeli güncellemesi (18 Ekim 2026):** MCP sunucusu kullanıcı access token'ını değiştirmeden Admin API'ye iletir. MCP token'ı hem yapılandırılmış MCP resource audience'ını hem `admin-api` audience'ını taşır. Backend `mcp.read` + iki audience'ı doğrular, MCP token'larını açıkça izin verilen GET endpoint'leriyle sınırlar ve mevcut endpoint/rol yetkilerini uygular. MCP token-exchange istemcisi, client secret, kodu, metrikleri, dashboard panelleri ve uyarısı kaldırılmıştır.

## 1. Amaç ve karar

Kitezh MCP Server, yetkili bir operatörün bir MCP istemcisinden Kitezh kimlik ve erişim verilerini sorgulamasını sağlar. İlk sürüm; kullanıcı, grup, istemci, oturum ve denetim kayıtları hakkında güvenilir, sayfalanmış ve kaynak bağlantısı içeren yanıtlar üretir. Yönetim değişiklikleri sonraki aşamada, her işlem için ayrı yetki ve sunucu tarafı onay akışıyla açılır.

**Mimari karar:** Kitezh MCP Server, ana Kitezh uygulamasından ayrı çalışan bir Spring Boot uygulaması ve ayrı bir Render Web Service olacaktır. Dış MCP istemcileri sunucuya ayrı bir genel adres üzerinden bağlanır; önerilen üretim adresi `https://mcp.<kitezh-domain>/mcp`, Render varsayılan adresi ise `https://kitezh-mcp.onrender.com/mcp` biçimindedir. MCP sunucusu Kitezh veritabanına, JPA repository'lerine veya uygulama içi `Admin*Service` sınıflarına doğrudan erişmez. Yalnız sürümlü Kitezh yönetim API'sini çağırır.

Kaynak kodu ilk aşamada aynı Git deposunda bağımsız bir Maven modülü/uygulaması olarak tutulabilir; fakat ayrı artifact, ayrı başlangıç sınıfı, ayrı Docker imajı, ayrı ortam değişkenleri, ayrı sağlık kontrolü ve ayrı Render deploy yaşam döngüsü bulunur. Ana Kitezh uygulaması MCP bağımlılıklarını yüklemez ve `/mcp` endpoint'i yayımlamaz.

**Teknoloji kararı:** Ayrı MCP uygulamasının tool ve Streamable HTTP katmanı için Spring Boot 4.x ile uyumlu **Spring AI 2.x MCP Server WebMVC starter** kullanılacak. Uygulama bir LLM modeli çağırmayacağı için Spring AI'nin model sağlayıcısı, prompt zinciri veya vector store bileşenleri eklenmeyecek. MCP giriş kimlik doğrulaması Spring Security resource server ile yapılır. Kitezh yönetim API'sine kullanıcı adına erişim, OAuth 2.0 Token Exchange ile alınan kısa ömürlü ve `admin-api` audience değerine bağlı ikinci bir token üzerinden yapılır.

MCP sunucusu, modelin çağırabileceği **sınırlı iş araçları** sunar. Genel URL çağırma, SQL çalıştırma, rastgele REST yolu çağırma veya tüm OpenAPI işlemlerini otomatik araçlara dönüştürme yoktur.

## 2. Araştırma ve ürün çıkarımları

| İncelenen sunucu / kaynak | Gözlem | Kitezh kararı |
| --- | --- | --- |
| [GitHub'ın resmi MCP sunucusu](https://github.com/github/github-mcp-server) | Uzak Streamable HTTP için OAuth resource metadata ve scope challenge; sunucu tarafında `toolsets`, tekil araç izin/ret listeleri, scope filtreleme ve her istekte gevşetilemeyen salt okunur sınır sunar. | Kullanıcı yapılandırması yalnız yönetici tarafından sabitlenmiş sunucu araç üst sınırını daraltabilir; salt okunur sınırı istekle kaldırılamaz. |
| [Grafana'nın resmi MCP sunucusu](https://grafana.com/docs/grafana/latest/developer-resources/mcp/) | Açık kaynak MCP sunucusu Grafana'dan ayrı bir binary/container olarak çalışır ve Grafana API'sine bağlanır; Grafana Cloud ayrıca barındırılan, OAuth tabanlı uzak MCP hizmeti sunar. | Kitezh MCP de ayrı deploy edilir, Kitezh API'sini kullanır ve dış istemciyi kullanıcı adına OAuth ile yetkilendirir. |
| [SonarQube'un resmi MCP sunucusu](https://github.com/SonarSource/sonarqube-mcp-server) | Seçici araç kümeleri ve salt okunur çalışma modu ile ajan bağlamını ve yazma yüzeyini daraltır. | Küçük varsayılan katalog; `read_only=true` olduğunda yazma araçları hiç yayımlanmaz. |
| [Keycloak MCP topluluk örneği: odaklı araçlar](https://github.com/shigechika/keycloak-mcp) | Kullanıcı, istemci, oturum ve olay incelemesi odaklıdır; yazma yetkisi ve grup değişiklikleri ayrıca sınırlandırılır. | İlk sürümde tanılama/inceleme akışlarını öncele; üyelik ve rol değişiklikleri için plan/uygula modeli kullan. |
| [Keycloak MCP topluluk örneği: geniş yüzey](https://github.com/paoloamato2/keycloak-mcp-server) | 299 yönetim API işlemini araç olarak açtığını ve hassas yazma işlemleri için güvenlik uyarısını kendi belgesinde belirtir. | API kataloğunu otomatik dışa aktarma. Her aracı ayrı ürün ve güvenlik incelemesinden geçir. |
| [Keycloak'ın resmi MCP yetkilendirme rehberi](https://github.com/keycloak/keycloak/blob/main/docs/guides/securing-apps/mcp-authz-server.adoc) | Keycloak'ın **MCP için yetkilendirme sunucusu** olarak kullanımı, audience ve istemci kayıt seçeneklerini anlatır. Bu, resmi bir Keycloak yönetim MCP sunucusu anlamına gelmez. | Kitezh'in OAuth sunucusu ile MCP kaynak sunucusunun görevlerini açıkça ayır. |

Protokol hedefi [MCP 2026-07-28 belirtimi](https://modelcontextprotocol.io/specification/2026-07-28) olmalıdır. Spring AI 2.0.1'in bağımlı olduğu MCP Java SDK 2.0.0 yalnızca `2025-11-25` sürümüne kadar protokol sabiti içerir. Mevcut entegrasyon testi `2025-11-25` ile `initialize`, `tools/list`, salt okunur araç işaretleri ve Prometheus metriklerini doğrular. `2026-07-28` desteği SDK/Spring AI sürüm güncellemesi ve MCP Inspector/gerçek istemci doğrulaması tamamlanana kadar açık kabul maddesidir; eski SSE taşıması yeni ürün yüzeyi olarak açılmaz.

### 2.1. Canlı durum ve eksik analizi (17 Ekim 2026)

Bu inceleme canlı `kitezh-mcp.onrender.com` akışını, `mcp/` uygulamasını, kök OAuth istemci seed verisini ve resmi [GitHub MCP Server yapılandırma](https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md), [GitHub Streamable HTTP](https://github.com/github/github-mcp-server/blob/main/docs/streamable-http.md) ve [MCP 2026-07-28 taşıma](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) belgelerini karşılaştırır.

| Öncelik | Bulgu | Kabul için gereken çalışma |
| --- | --- | --- |
| **P0 — kapsam fazlası (uygulandı)** | `mcp-client` CSV seed'i yalnız `openid,mcp.read` kapsamlarını tanımlar. Authorization Code entegrasyon testi verilen kapsamları ve JWT `scope` claim'ini doğruluyor; access token'daki izinli `roles` claim'i ayrıca `roles` OAuth kapsamı vermeden ekleniyor. Server-side token exchange `admin-api roles` kullanmaya devam ediyor. | Yerel testler geçti. Canlı authorization-code ve refresh akışı yeni seed ile yayınlandıktan sonra tekrar doğrulanmalı. |
| **P0 — kullanıcıya göre araç yetkisi (uygulandı)** | 40 araç için rol haritası backend Admin API GET kurallarıyla hizalı. `tools/list` token yetkilerine göre filtreleniyor; bilinmeyen araç/rol için liste boş kalıyor ve doğrudan `tools/call` aynı kontrolle reddediliyor. MCP API güvenlik kontrolleri nihai yetki kararı olmaya devam ediyor. | Admin, sınırlı rol, bilinmeyen rol, doğrudan çağrı ve JWT `roles` claim'inden authority üretimi entegrasyon testleriyle doğrulandı. |
| **P0 — Origin/Host ve metadata adresi (uygulandı)** | MCP CORS ayarı backend CorsConfig'teki açık origin yaklaşımını, HTTP yöntem/başlıklarını, credentials ve 3600 saniyelik max-age politikasını izliyor; MCP protokol başlıkları ekli. `Origin` ve Host izin listeleri uygulanıyor, forwarded header'lar güvenilmiyor, metadata yalnız `APP_MCP_PUBLIC_URL` üzerinden üretiliyor. İstek başlıkları 16 KiB, MCP gövdesi 1 MiB ile sınırlı; Tomcat bağlantı/iş parçacığı sayıları sınırlandırılmıştır. | CORS preflight, izinli/ret edilen Origin, sahte Host/forwarded header ve gövde boyutu testleriyle doğrulanıyor. Kullanıcı/IP başına oran sınırlaması halen açık P1 işletim işidir; güvenilir proxy IP kaynağı ve dağıtık limiter kararı gerekir. |
| **P0 — güncel protokol uyumluluğu** | Uygulama `2025-11-25` ailesindeki handshake'i destekliyor; canlı testte `2025-03-26` `initialize` ile bağlantı da başarılı oldu. Bu, yayımlanmış `2026-07-28` protokol desteğini kanıtlamaz. Yeni sürüm handshake/session başlıklarını kaldırıp `server/discover` ve istek başına protokol bağlamı getiriyor; Streamable HTTP isteklerinde `Mcp-Method` ve `Mcp-Name` başlıklarını standartlaştırıyor. | Spring AI/MCP Java SDK güncellemesiyle `2026-07-28` desteğini ekle ya da bu sürümü destek dışı ilan edip istemci uyumluluk matrisini yayımla. `server/discover`, standart MCP istek başlıkları, stateless çağrı, eski istemci geriye uyumluluğu ve gerçek Codex/Claude/Inspector bağlantısını test et. Eski SSE taşıması açma. |
| **P1 — araç katalog yapılandırması (uygulandı)** | Dağıtım operatörü `APP_MCP_TOOLSETS` ile etkin toolset'leri (`users`, `groups`, `clients`, `roles`, `events`, `organizations`, `context`, `dashboard`, `notifications`, `signing-keys` veya `all`), `APP_MCP_TOOL_ALLOWLIST` ile izin verilen tam araç adlarının üst sınırını belirler. Varsayılanlar sırasıyla `all` ve `*` olup mevcut kataloğu korur. Etkin araçlar = yapılandırılmış toolset'lerin birleşimi ∩ sunucu allowlist'i ∩ çağıranın rolüne izin verilen araçlar. Her iki ayar da yalnız sunucu/dağıtım yapılandırmasıdır; MCP istemcisi veya istek başlıkları bu sınırları genişletemez. | Başlangıç yapılandırma testi varsayılanları ve geçersiz değer davranışını; entegrasyon testleri toolset birleşimini, allowlist kesişimini, rol filtresini, `tools/list` sonucunu ve doğrudan `tools/call` reddini doğrular. Salt okunur politika sunucuda zorunludur. |
| **P1 — şema ve çıktı sözleşmesi** | Araçlar parametreleri ve `readOnlyHint` gibi anotasyonları yayımlıyor; `Map<?, ?>` sonuçları için sürümlü, doğrulanabilir `outputSchema` / yapılandırılmış çıktı sözleşmesinin uçtan uca kabulü gösterilmedi. | Her aracın JSON Schema'sını sabitle; liste/detay yanıtlarında yapılandırılmış çıktı kullan ve eski istemciler için metin uyumluluğunu koru. Şema uyumu, deterministik araç sıralaması, null/boş sonuç ve PII dışlama testleri ekle. |
| **P1 — üretim işletim kontrolleri** | Mevcut metrikler araç ve downstream istek sayı/süresini ölçüyor; kullanıcı/istemci başına hız sınırı ve araç çağrısı audit kaydında aktör + araç + sonuç + trace korelasyonu kabul testleriyle kanıtlanmış değil. | MCP ingress ve downstream API için oran/konkürensi, istek/yanıt boyutu ve toplam zaman sınırı tanımla. Loglarda token veya hassas payload olmadan kararlı aktör/client kimliği, araç, sonuç ve trace ID üret; iptal edilen istek downstream çağrısını da durdursun. Render/Grafana alarm ve yük testinde sınırları doğrula. |

GitHub'ın scope ve araç filtrelemesi faydalı bir ürün/operasyon örneğidir; onun `X-MCP-*` başlıklarının kullanıcı yetkisini değiştirmesine izin vermek Kitezh için uygun değildir. Kitezh'de başlık ya da istemci seçimi yalnız yönetici tarafından ayarlanmış araç üst sınırını daraltabilir; yetki kararı her zaman OAuth token'ı ve Kitezh API tarafından verilir. GitHub'ın public repository içerikleri için sunduğu best-effort lockdown, Kitezh yetkilendirmesiyle eşdeğer değildir. Kitezh de kullanıcı adı, grup adı ve audit metinlerini güvenilmeyen veri olarak ele almalı; prompt-injection içeriğinin araç talimatına dönüşmediğini adversarial testlerle doğrulamalıdır.

## 3. Mevcut Kitezh durumu

- Uygulama tek issuer kullanır; Keycloak realm seçicisine denk çoklu realm sınırı yoktur. MCP araçlarına `realm` parametresi eklenmez.
- Yönetim verileri `/api/admin/**` altında yer alır. Kullanıcı, grup, istemci, oturum, olay ve genel arama uç noktaları ile ayrı `Admin*Service` sınıfları vardır.
- Yönetim API'si JWT issuer/audience doğrulaması, aktif authorization denetimi, DPoP ve `ROLE_*` yetkileri uygular. `whoami` mevcut kullanıcının yetki bayraklarını verir.
- Ayrı MCP audience, protected resource metadata, ön kayıtlı MCP istemcisi ve MCP + `admin-api` audience'larını taşıyan `mcp.read` token'ı uygulanmıştır. MCP, aynı bearer token'ını Admin API'ye iletir; backend MCP token'larını açık GET allowlist'i ve mevcut rol kontrolleriyle sınırlar.
- Normal Authorization Code + PKCE ile alınan token `/mcp` üzerinde kabul edilir; canlı uçtan uca denemede MCP `initialize`, `tools/list` ve `kitezh_get_context` başarılı olmuştur. Denemede `mcp-client` istemcisi kullanılmış, yeni istemci kaydı oluşturulmamıştır. Sonraki yerel değişiklikte istemci kapsamları `openid,mcp.read` olarak daraltıldı ve §2.1'de token scope testi eklendi; canlı yayın sonrası tekrar doğrulanmalıdır.
- MCP için confidential servis istemcisi veya client secret gerekmez. Yönetim API'si her çağrıda audience, `mcp.read`, HTTP metodu, endpoint allowlist'i ve mevcut rol kontrollerini uygular; MCP araç kataloğu da aynı token'daki filtrelenmiş Kitezh rollerine göre daraltılır ve doğrudan araç çağrısını denetler.
- Gruplar, roller veya kullanıcının etkin durumu değiştiğinde mevcut yönetim servislerinin audit ve `UserAccessInvalidationService` davranışı korunmalıdır.

Bu saptamalar 17 Ekim 2026 tarihli çalışma ağacı ve canlı Render denemesinden yapılmıştır; özellikle `McpSecurityConfig`, `KitezhTokenExchangeClient`, `KitezhMcpTools`, Authorization Server istemci CSV'si ve ilgili yönetim API güvenlik kuralları incelenmiştir.

## 4. Kullanıcılar, işler ve başarı ölçütleri

**Birincil kullanıcılar:** salt okunur denetçi, destek operatörü, sınırlı yetkili kullanıcı/istemci yöneticisi. MCP istemcisi, bu kişinin adına işlem yapar; ayrıcalıklı bir ortak yönetici hesabı kullanmaz.

**Örnek işler:**

1. “Devre dışı kullanıcıları göster; 20 sonuçla sınırla.”
2. “Bu kullanıcının gruplarını ve etkin rollerini açıkla.”
3. “Şu istemcinin izinli akışlarını, kapsamlarını ve son oturumlarını göster.”
4. “Son bir saatteki kullanıcı ve istemci yönetim olaylarını filtrele.”
5. İkinci aşamada: “Bu kullanıcıyı devre dışı bırak” isteğini önce etkileriyle önizle, sonra açıkça onaylanmış işlem olarak uygula.

**Ölçülebilir kabul hedefleri:**

- Pilot görev setindeki 20 salt okunur senaryonun en az 18'i doğru araç ve doğru kaynakla tamamlanır.
- Yetkisiz alanı veya veriyi döndüren test vakası: **0**.
- Tüm liste araçları `size <= 100` uygular; varsayılan `size=20`, kararlı sıralama ve toplam/sayfa bilgisi döner.
- Tipik liste/detay çağrılarında MCP → Kitezh API dahil uçtan uca p95 < 3 saniye; Render soğuk başlangıcı hariç. Hedef yük testiyle doğrulanır.
- Her araç çağrısının aktörü, istemci kimliği, araç adı, sonuç durumu, süre ve iz kimliği kaydedilir; token, parola, istemci sırrı ve ham hassas yanıt loglanmaz.

## 5. Sürüm kapsamı

### P0 — Salt okunur MVP

- Ayrı Render Web Service üzerinde tek `/mcp` Streamable HTTP uç noktası, stateless istek işleme ve HTTPS dağıtımı.
- OAuth ile kullanıcı adına oturum, ayrı MCP audience, protected resource metadata ve ön kayıtlı MCP istemcileri.
- MCP token'ını Kitezh API'ye taşımadan, OAuth 2.0 Token Exchange ile kısa ömürlü `admin-api` token'ı alma.
- Kitezh yönetim API'sine yalnız HTTP üzerinden erişim; MCP uygulamasında veritabanı/JPA bağlantısı bulunmaması.
- `context`, `users`, `groups`, `clients`, `sessions`, `events` araç kümeleri.
- Operatör düzeyinde görünürlük: yalnız yetkili araçlar `tools/list` sonucunda gösterilir; `tools/call` içinde aynı yetki yeniden denetlenir.
- Arama, sayfalama, veri azaltma, yapılandırılmış JSON çıktı, açık hata kodları, audit ve metrikler.
- En az bir gerçek MCP istemcisi ve MCP Inspector ile uçtan uca doğrulama.

### P1 — Kontrollü yazma

- Ayrı `users_write`, `groups_write`, `sessions_write` kümeleri; varsayılan kapalı.
- Kullanıcı etkinleştirme/devre dışı bırakma, gruba ekleme/çıkarma ve tek kullanıcı oturumunu iptal etme için **önizle → uygula** akışı.
- Önizleme sonucu hedef ID'leri, mevcut durum özeti, değişiklik, etkilenecek oturum/token sayısı veya bunun hesaplanamadığı bilgisi, gerekli yetki, kısa süreli onay belirteci içerir.
- Uygulama çağrısı belirteci kullanıcıya/istemciye/hedefe bağlar, son kullanma süresini ve mevcut durum özetini tekrar denetler; değişiklik olmuşsa işlemi reddeder. Mevcut servis işlemi, audit ve erişim iptali aynı işlem sınırında çalışır.
- Aracın sonucu hangi kayıtların değiştiğini ve hangi oturum/authorization etkisinin gerçekleştiğini açıkça döner.

### P2 — Ayrı karar gerektiren genişleme

İstemci oluşturma/düzenleme, rol atama, parola sıfırlama, sır döndürme, anahtar yönetimi, toplu silme, impersonation, genel oturum iptali, sosyal sağlayıcı/LDAP/UMA politikası değiştirme ve rastgele yönetim ayarları. Bu işlemler P0 veya P1'in örtük parçası değildir; her biri için ayrı tehdit modeli, yetki, audit, etki ve test tasarımı gerekir.

## 6. P0 araç sözleşmesi

İsimler sabit `kitezh_` öneki taşır. Liste araçları `page` (0 tabanlı), `size` (1–100) ve açık filtre alır. Serbest sorgu metni yalnız ilgili servis filtresine gider; URL, SQL veya komut olarak yorumlanmaz. Çıktılar DTO tabanlıdır ve isteğe uygun alanları seçer.

| Araç | Girdi | Çıktı | Yetki | Kitezh API kaynağı |
| --- | --- | --- | --- | --- |
| `kitezh_get_context` | Yok | issuer, bağlantı kimliği, izinli araç kümeleri, admin yetki özeti | Geçerli MCP token | `GET /api/admin/whoami` |
| `kitezh_search_users` | `q`, `enabled`, `page`, `size` | Kullanıcı özeti sayfası | Kullanıcı sorgulama/görüntüleme | `GET /api/admin/users` |
| `kitezh_get_user` | `userId` | Profil özeti; parola/kimlik bilgisi yok | Kullanıcı görüntüleme | `GET /api/admin/users/{id}` |
| `kitezh_list_user_groups` | `userId`, `q`, `page`, `size` | Grup sayfası | Kullanıcı ve grup görüntüleme kuralları | `GET /api/admin/users/{id}/groups` |
| `kitezh_search_groups` | `q`, `page`, `size` | Grup özeti sayfası | Grup sorgulama/görüntüleme | `GET /api/admin/groups` |
| `kitezh_get_group` | `groupId` | Grup ayrıntısı ve izinli rol özeti | Grup görüntüleme | `GET /api/admin/groups/{id}` |
| `kitezh_search_clients` | `q`, `page`, `size` | İstemci özeti sayfası | İstemci sorgulama/görüntüleme | `GET /api/admin/clients` |
| `kitezh_get_client` | `clientRecordId` | Akışlar, redirect URI'ler, kapsamlar; sır ve hash yok | İstemci görüntüleme | `GET /api/admin/clients/{id}` |
| `kitezh_list_sessions` | `userId?`, `page`, `size` | Oturum metaverisi sayfası; token yok | Oturum görüntüleme | `GET /api/admin/sessions` veya kullanıcı oturumları |
| `kitezh_search_events` | `q?`, `action?`, `targetType?`, `targetId?`, `from?`, `to?`, `page`, `size` | Yönetim denetim olayı sayfası | `EVENT_VIEWER`/`EVENT_MANAGER`/`ADMIN` | `GET /api/admin/events` |

### Kitezh özelliklerine göre araç kapsamı

MCP kataloğunda şu anda 40 salt okunur araç vardır. İlk kullanıcı/grup/istemci/oturum/olay araçlarına rol ve grup izinleri, OAuth client-scope/consent/service-account ve redakte edilmiş mapper incelemesi, organizasyon sorguları, kullanıcı gerekli aksiyonları, offline oturumlar, yönetici bildirimleri, toplu dashboard sayıları ve imzalama anahtarı public metadata'sı eklendi. JSON dizisi döndüren güvenli Admin API uçları da tipli liste desteğiyle okunabilir. Bu kapsam Administration Console ve Account Console özelliklerinin tamamını karşılamaz. Aşağıdaki durumlar ilgili controller GET uç noktalarıyla karşılaştırılmıştır; bütün API'leri otomatik MCP aracı yapmak amaçlanmıyor.

| Kitezh özelliği | Mevcut kapsama göre eksik | Önerilen sıra ve sınır |
| --- | --- | --- |
| Roller ve yetki eşlemeleri | Kullanıcı ve grup detayları zaten assigned/inherited/effective role özetlerini içeriyor; realm/client role üyeliği ve composite özetleri de rol detaylarında mevcut. Atama değişiklikleri yazma kapsamıdır ve ayrı MCP aracı değildir. | **Tamamlandı (salt okunur görünüm):** `kitezh_search_roles`, `kitezh_get_role`, `kitezh_search_client_roles`, `kitezh_get_client_role`, `kitezh_list_group_members`, `kitezh_get_group_permissions`; mevcut `kitezh_get_user` ve `kitezh_get_group` rol özetlerini döndürür. |
| OAuth client ayrıntıları | Scope kataloğu/atamaları/değerlendirmesi, consents, service-account rol özeti ve redakte mapper metadata'sı eklendi; client alt kaynak event/session ayrıntıları ayrı araç değil. | **Kısmen tamamlandı:** `kitezh_search_client_scopes`, `kitezh_get_client_scope`, `kitezh_get_client_scope_assignments`, `kitezh_evaluate_client_scopes`, `kitezh_search_consents`, `kitezh_list_user_consents`, `kitezh_get_user_consent`, `kitezh_get_service_account`, `kitezh_list_client_mappers`, `kitezh_list_client_scope_mappers`. Mapper `value` ve tanınmayan alanlar elenir. |
| Kullanıcı oturum ve onayları | User consent, offline session ve required-action araçları eklendi; profil alanları ve WebAuthn credential metadata eksik. | **Kısmen tamamlandı:** `kitezh_list_offline_sessions`, `kitezh_list_user_required_actions` ve consent araçları. **P2:** MFA/WebAuthn metadata; hassas authenticator, token veya credential materyali asla dönme. |
| Organizasyonlar | Organizasyon, üyeler, gruplar/grup üyeleri, alan adları, davetler, identity provider bağlantıları ve redakte claim metaverisi eklendi. | **Tamamlandı (salt okunur özet):** organizasyon arama/detay/üyelik/domain/invitation araçları ile `kitezh_list_organization_identity_providers` ve `kitezh_list_organization_claims`. E-posta, davet/DNS doğrulama token'ı ve claim value alanı dönmez. |
| Identity provider ve LDAP | Sağlayıcılar, mapper'lar, native policy; LDAP provider ve mapper yapılandırması. | **P2:** yalnız sırları redakte edilmiş bağlantı durumu ve mapper özeti. LDAP test/senkronizasyonu ve sağlayıcı değişiklikleri MCP aracı olmasın. |
| Authorization Services / UMA | Korunan kaynak, policy ve permission arama/detayı. | **P2:** hassas kaynak/sahip bilgisi için ayrı izin modeliyle salt okunur özet; policy/permission değişiklikleri yazma kapsamı. |
| Authentication ve güvenlik politikaları | Authentication flow/binding/provider; CIBA, offline access, login, CAPTCHA, required-action, e-posta ve sosyal provider ayarları. | **P2:** yalnız operasyonel, secret içermeyen yapılandırma özeti. Flow çalıştırma, bağlantı testi ve politika güncelleme araçları yok. |
| Instance yönetim ayarları | Branding, localization/message override, kullanıcı profili, notification ayarları ve server-info yapılandırması kapsam dışı; dashboard'dan yalnız toplu sayaçlar eklendi. | `kitezh_get_admin_dashboard_summary` kullanıcı kimliği veya anahtar metaverisi olmadan client/user/session/consent toplamlarını döndürür. Diğer ayarlar için özellik bazlı yetki ve redaksiyon gerekir; ham yapılandırma döndürülmez. |
| Yönetici bildirimleri ve çapraz arama | Yönetici bildirim listesi eklendi; global search kullanıcı adı, tam ad ve e-posta döndürdüğü için eklenmedi. | `kitezh_list_admin_notifications` yalnız id, sabit mesaj anahtarı, zaman ve geçerli yöneticinin okundu bilgisini döndürür. Global search, PII azaltılmış bir API sözleşmesi olmadan açılmamalı. |
| Signing keys | Yalnız whitelist edilmiş public metadata alanlarıyla sayfalı key listesi eklendi. | `kitezh_list_signing_key_metadata` yalnız key ID, algoritma, kullanım ve durum metaverisini döndürür; public-key bytes, private key veya döndürme işlemi yok. |
| Account Console güvenliği | Kişisel access token metadata'sı, MFA ve sosyal hesap bağlantıları. | **P2/ayrı kapsam:** sadece oturum açmış kişinin kendi hesabı ve `account.read` yetkisiyle değerlendirilir. PAT secret'ı hiçbir zaman okunamaz; oluşturma/iptal MCP read-only araçlarına eklenmez. |

**Sıradaki MCP kapsamı:** user profile metadata ve WebAuthn credential özeti incelenebilir. Her yeni araç rol korumalı sabit Admin API GET uç noktasına bağlanmalı, hassas alanları redakte etmeli, input'u sınırlandırmalı ve ilgili sözleşme/test eklenmelidir. Global search'te gereksiz PII döndüğünden güvenli API DTO'su oluşmadan araç eklenmemelidir.

Araç isimleri ve filtrelerin tam JSON Schema'sı uygulama başlamadan önce `contracts/mcp-tools.json` benzeri sürümlü bir sözleşmede dondurulur. Her araçta `title`, ne zaman kullanılacağına dair kısa açıklama, doğrulanan `inputSchema`, mümkünse `outputSchema`, doğru `readOnlyHint` ve hassas veri sınıfı bulunur. Yapılandırılmış çıktı ile metin özeti birlikte dönebilir; özette gereksiz PII çoğaltılmaz. [MCP araç belirtimi](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) yapılandırılmış çıktı ve şema kurallarını tanımlar.

MVP'de dinamik `resources` ve `prompts` yayımlamak zorunlu değildir. Sonraki aşamada salt okunur, kimliğe göre yetkilendirilmiş `kitezh://...` kaynakları eklenebilir; kaynak URI'sı yetkiyi aşan alternatif bir yol oluşturamaz.

## 7. Yetkilendirme ve güvenlik sözleşmesi

1. **Ayrı kaynak kimliği:** MCP kaynağı kendi genel URI'siyle tanımlanır, örneğin `https://mcp.kitezh.example/mcp`. Gelen token `iss`, `exp`, imza ve bu URI'ye bağlı `aud` açısından MCP servisinde doğrulanır. `admin-api` veya başka bir servis için verilmiş token `/mcp` üzerinde kabul edilmez. MCP belirtimi audience doğrulamasını zorunlu tutar: [MCP Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
2. **Keşif:** MCP kaynağı RFC 9728 Protected Resource Metadata yayımlar; 401 yanıtında `WWW-Authenticate` ile metadata ve asgari kapsamı bildirir. Kitezh yetkilendirme sunucusu OIDC/OAuth metadata üzerinden keşfedilir. Eksik kapsamda 403 ve gerekli kapsam bilgisi döner.
3. **İstemci kaydı:** P0'da bilinen MCP istemcileri Kitezh Authorization Server'a yönetici tarafından ön kaydedilir; Authorization Code + PKCE S256 ve kesin redirect URI listesi kullanılır. DCR veya Client ID Metadata Documents desteği, SSRF/redirect/istemci politikaları ve kullanılan istemci uyumluluğu ayrı tasarlanıp P1 sonrası değerlendirilebilir. `client_credentials` insan adına yönetim için kullanılmaz.
4. **Kapsam ve rol:** Yeni `mcp.read` kapsamı MCP giriş iznidir; gerçek nesne/işlem yetkisi mevcut `ROLE_*` ve servis kontrollerinden gelir. P1 için ayrı `mcp.write` gerekir. `mcp.write`, rol yetkisinin yerine geçmez.
5. **Doğrudan token iletimi ve audience ayrımı:** Authorization Server, `mcp.read` kapsamlı kullanıcı token'ına yapılandırılmış MCP resource URI'si ve `admin-api` audience'larını ekler. MCP, bu token'ı değiştirmeden typed Admin API çağrısında bearer olarak iletir. Backend iki audience'ı, `mcp.read` kapsamını, HTTP `GET` metodunu ve MCP araçlarının kullandığı açık endpoint allowlist'ini zorunlu tutar.
6. **Yetkinin kaynağı:** MCP servisi araç listesini kullanıcı bağlamına göre daraltabilir; nihai authorization kararı her Kitezh API çağrısında `AdminApiSecurityConfig` ve servis katmanında verilir. MCP token'ı allowlist dışı endpoint veya yazma metoduna erişemez; izinli endpoint'lerde mevcut rol kontrolleri uygulanır.
7. **İptal:** Kullanıcı kapatılması, yetki veya grup değişikliği, oturum/token iptali sonraki MCP çağrısında geçerli olmalıdır. MCP ve Kitezh API decoder'ı aynı access token için aktif authorization/revocation denetimini uygular; yetki kararı uzun süre cache'lenmez.
8. **Servis kimliği:** MCP kullanıcı access token'ını doğrudan ilettiği için MCP confidential client secret'ı veya service-to-service OAuth kimliği kullanılmaz. Yetki kullanıcı token'ı ve onun rollerinden gelir.
9. **Araç görünürlüğü:** Dağıtımın izin verdiği kümeler üst sınırdır. Kullanıcı/istemci bunları yalnız daraltabilir. Salt okunur dağıtımda yazma aracı `tools/list` içinde bulunmaz; adı bilinse bile `tools/call` reddedilir.
10. **Veri ve çıktı güvenliği:** Parola, parola hash'i, istemci sırrı, özel JWK, kurtarma kodu, access/refresh/ID token, SAML anahtarı ve şifreleme anahtarı hiçbir araç sonucunda bulunmaz. Kullanıcı ve olay verileri güvenilmeyen içeriktir; araç metni talimat gibi yorumlanmaz. Çıktı boyutu, sayfa boyutu ve çağrı süresi sınırlandırılır.
11. **Tarayıcı/HTTP sınırı:** HTTPS zorunlu; `Origin`/Host doğrulaması ve dar CORS listesi uygulanır. MCP endpoint'i oturum çerezinden kimlik almaz; bearer token gerektirir. `GET` ile değişiklik yapılmaz.

## 8. Mimari ve çalışma davranışı

```text
MCP istemcisi
   │  OAuth Authorization Code + PKCE
   ▼
Kitezh Authorization Server ── MCP audience'lı kullanıcı token'ı
   │
   ▼
Kitezh MCP Server (ayrı Render Web Service)
   /mcp → güvenlik zinciri → tool katmanı
                               │
                               ├─ OAuth Token Exchange
                               │  audience: admin-api
                               ▼
Kitezh yönetim API'si (ayrı Render Web Service)
   /api/admin/** → mevcut güvenlik + Admin*Service
                               │
                               ▼
                  JPA / audit / cache / erişim iptali
```

- MCP uygulaması yalnız Spring AI MCP, Spring Security resource server, HTTP client, gözlemlenebilirlik ve tool DTO bağımlılıklarını taşır. JPA, Liquibase ve Kitezh domain repository bağımlılıklarını taşımaz.
- Kullanıcı kimliği MCP girişinde, kullanıcı yetkisi ise Kitezh API çağrısında yeniden doğrulanır. Tool sınıfları yalnız tipli bir `KitezhAdminApiClient` kullanır.
- API istemcisi Spring `RestClient`/uygun HTTP istemcisi ile zaman aşımı, sınırlı güvenli retry ve correlation/trace header aktarımı uygular. Mutation çağrıları otomatik tekrar edilmez.
- Ortak sözleşmeler ayrı bir hafif modülde paylaşılabilir veya Kitezh OpenAPI belgesinden tipli client üretilebilir. JPA entity ve servis sınıfları MCP modülüne bağımlılık olarak eklenmez.
- MCP hata modeli ile HTTP güvenlik hataları ayrılır: kimlik eksik/geçersiz 401, kapsam/rol yetersiz 403, hatalı argüman yapılandırılmış araç hatası, bulunamayan kaynak açık `not_found`, beklenmeyen hata iz kimlikli genel yanıt. İç stack trace ve sırlar kullanıcıya dönmez.
- Araç ve çıktı şemaları sürümlenir. Bir alan kaldırma veya semantik değiştirme kırıcı değişiklik sayılır; yeni araç/alan ekleme geriye uyumlu biçimde yapılır.
- `APP_MCP_TOOLSETS` etkin toolset'leri (`users`, `groups`, `clients`, `roles`, `events`, `organizations`, `context`, `dashboard`, `notifications`, `signing-keys` veya `all`), `APP_MCP_TOOL_ALLOWLIST` tekil araç adlarının sunucu üst sınırını belirler. Varsayılanlar `all` ve `*`'dır. Etkin araç kümesi toolset birleşimi ile allowlist ve çağıran rolünün izin verdiği araçların kesişimidir. Bunlar yalnız dağıtım ayarlarıdır; istemci başlığı, tool argümanı veya `tools/list` tercihi araç erişimini genişletemez. Salt okunur sınır sunucuda zorunlu tutulur.
- Gözlemlenebilirlik: MCP servisinde Micrometer/Actuator üzerinden çağrı sayısı, 401/403, downstream süre/hata, araç hatası ve çıktı boyutu izlenir. `traceparent` ve correlation ID Kitezh API'ye aktarılır. MCP erişim kaydı ile Kitezh audit kaydı aynı iz kimliği üzerinden ilişkilendirilir; gizli veri eklenmez.

## 9. Render dağıtım modeli

| Özellik | Kitezh uygulaması | Kitezh MCP Server |
| --- | --- | --- |
| Render tipi | Mevcut Web Service | Ayrı Web Service |
| Genel adres | Mevcut Kitezh issuer/API adresi | `https://mcp.<kitezh-domain>/mcp` |
| Artifact | Ana Kitezh Spring Boot artifact'ı | Bağımsız MCP Spring Boot artifact'ı |
| Veritabanı | PostgreSQL'e sahip/bağlı | Veritabanı bağlantısı yok |
| Dış protokol | OAuth/OIDC ve uygulama API'leri | MCP Streamable HTTP |
| Servisler arası erişim | `/api/admin/**` sunar | Kitezh API'yi çağırır |
| Ölçekleme/deploy | Bağımsız | Bağımsız |

- İki servis aynı Render bölgesinde çalışır. MCP → Kitezh API çağrılarında mümkünse Render private network adresi kullanılır; OAuth issuer, redirect URI ve MCP resource identifier her zaman kararlı genel HTTPS adresleridir.
- MCP servisi dış MCP istemcileri tarafından erişileceği için Render **Web Service** olmalıdır. Private Service tek başına uygun değildir; yalnız diğer Render servislerinden erişilebilir.
- MCP servisinin sağlık endpoint'i `/actuator/health/readiness` olur. Render health check bu endpoint'i kullanır; MCP protokol endpoint'i health check için çağrılmaz.
- MCP servisi ayrı Docker image/build ve start command ile dağıtılır. Ana Kitezh deploy'u MCP servisini otomatik olarak yeniden başlatmaz; sözleşme değişikliklerinde iki deploy uyumlu sırayla yayımlanır.
- Asgari ortam değişkenleri: `APP_AUTHORIZATIONSERVER_ISSUER`, `APP_API_BASE_URL`, `APP_MCP_PUBLIC_URL`, ayrıca sunucu tarafı katalog sınırları için `APP_MCP_TOOLSETS` (varsayılan `all`) ve `APP_MCP_TOOL_ALLOWLIST` (varsayılan `*`). MCP için client ID/secret tanımlanmaz; toolset/allowlist değerleri yalnız operatörün deployment yapılandırmasından değiştirilir.
- Production'da özel alan adı önerilir. Render'ın `onrender.com` adresi geliştirme/pilot için kullanılabilir; OAuth resource ve redirect kayıtları kullanılan gerçek genel adresle birebir eşleşir.
- MCP servisi erişilemez olduğunda ana Kitezh login ve yönetim uygulaması çalışmaya devam eder. Kitezh API erişilemez olduğunda MCP sunucusu sınırlı süre içinde `upstream_unavailable` döner; eski veri sunmaz.

## 10. Kabul senaryoları

| Kimlik / istek | Beklenen sonuç |
| --- | --- |
| Token yok | `/mcp` 401 ve protected resource keşif bilgisi. |
| Geçerli `admin-api` audience token'ı | 401; MCP kaynağına yönelik token gerekir. |
| Public MCP istemcisi `openid mcp.read` ister | Token yalnız bu kapsamları verir; `admin-api` ve `roles` claim'leri dış istemci token'ına eklenmez. |
| MCP token audience ve API sınırı | Kullanıcı token'ı MCP resource ve `admin-api` audience'larını, ayrıca `mcp.read` kapsamını taşır; Admin API yalnız açıkça izin verilen GET rotalarını mevcut rollerle kabul eder. |
| `mcp.read` var, `ROLE_USER_QUERY` var | Kullanıcı araması çalışır; yetki dışı detay aracı listede görünmez ve çağrısı 403 döner. |
| Sınırlı kullanıcı `tools/list` ve doğrudan `tools/call` gönderir | Araç görünürlüğü kullanıcı rolüne göre daraltılır; elle yapılan yetkisiz çağrı da Kitezh API tarafından 403 ile engellenir. |
| Sahte `Origin`, `Host` veya forwarded host ile `/mcp` isteği | İzin listesi dışı istek reddedilir; 401 metadata adresi yalnız sabit public MCP URL'sini kullanır. |
| MCP `2026-07-28` istemcisi | `server/discover` ve istek başına stateless taşıma sözleşmesi başarıyla işler; desteklenen eski protokol sürümleri geriye dönük test edilir. |
| `tools/list` | İzinli araçlar kararlı sırada ve tanımlı input/output şemalarıyla döner; salt okunur katalogda yazma aracı bulunmaz. |
| Operatör toolset ve allowlist sınırı belirler | `tools/list` yalnız toolset birleşimi ∩ server allowlist ∩ rol iznini döndürür; istemci başlıkları veya tool parametreleri kapsamı genişletemez. Aynı sınır doğrudan `tools/call` için uygulanır. |
| İstek iptali/aşırı yük | İptal downstream HTTP çağrısını durdurur; kullanıcı/istemci başına hız ve boyut sınırları uygulanır. |
| MCP token'ının doğrudan Kitezh yönetim API'sine gönderilmesi | İki audience ve `mcp.read` ile sadece allowlist'teki GET yollarında geçer; rolü olmayan istek 403, yazma ve allowlist dışı istekler 403 alır. |
| MCP token'ı geçersiz/iptal edilmiş veya audience/scope eksik | MCP veya Admin API isteği reddeder; Kitezh verisi dönmez ve gizli ayrıntı açığa çıkmaz. |
| `ROLE_EVENT_VIEWER` var | Olay araması çalışır; olay silme aracı yayımlanmaz. |
| `size=101` veya bilinmeyen sıralama alanı | Doğrulama hatası; sınırsız sorgu oluşmaz. |
| Kullanıcı yetkisi/oturumu iptal edildikten sonra eski token | Sonraki çağrı reddedilir. |
| P0 salt okunur dağıtımda yazma adıyla doğrudan çağrı | Hiçbir değişiklik olmaz; çağrı reddedilir ve auditlenir. |
| P1 önizlemesinden sonra hedef değişmiş veya belirteç süresi dolmuş | Uygulama reddedilir; yeni önizleme gerekir. |
| İstemci sonucunda sır/token bulunan kaynak | Hassas alanlar yok; sözleşme testi bunu doğrular. |
| Aynı isteğin çoklu örnekten yürütülmesi | Kalıcı MCP oturumu veya yapışkan yönlendirme gerektirmez. |
| MCP Render servisi kapalı | Ana Kitezh servisi ve konsolları çalışmaya devam eder. |
| Kitezh API geçici olarak erişilemez | MCP sınırlı sürede `upstream_unavailable` döner; kontrolsüz retry yapmaz. |

## 11. Uygulama iş paketleri ve çıkış kapıları

1. **P0 OAuth least-privilege — uygulandı:** Dış MCP istemci kapsamı `openid,mcp.read`; rol claim'i yalnız MCP access token'ında yer alır ve OAuth `roles` kapsamı verilmez. Backend entegrasyon testi geçti. Yeni seed'in canlıda yayınlanması ve refresh davranışının tekrar doğrulanması kalır.
2. **P0 yetki matrisi — uygulandı:** Admin/sınırlı/bilinmeyen rol araç listesi, doğrudan çağrı reddi ve JWT role claim eşlemesi MCP entegrasyon testleriyle doğrulandı. Backend API kendi authorization kontrolünü korur.
3. **P0 HTTP güvenlik sınırı — uygulandı:** Origin/Host, sabit public metadata URL, backend ile hizalı CORS ve istek boyutu sınırları test ediliyor. Kullanıcı/IP bazlı rate limiting, güvenilir proxy IP ve dağıtık limit deposu kararıyla P1 kapsamında takip edilecek.
4. **P0 protokol uyumluluğu:** Yayımlanmış `2026-07-28` belirtimini destekleyen Spring AI/MCP Java SDK sürümüne geç; `server/discover`, stateless çağrı, şema, gerçek Codex/Claude/MCP Inspector bağlantısı ve geriye uyumluluk testlerini ekle. Sürüm desteklenmeyecekse README ve PRD'de açıkça belirt.
5. **P1 araç sözleşmesi:** P0 araçları için sürümlü input/output JSON Schema, yapılandırılmış çıktı, kararlı sıralama, alan redaksiyonu ve untrusted-content/prompt-injection testlerini tamamla.
6. **P1 işletim:** Aktör, client, araç, sonuç ve trace ID korelasyonunu hassas veri loglamadan ekle; Grafana alarmı, hız/konkürensi sınırı, uçtan uca gecikme ve upstream kesinti davranışını doğrula.
7. **P1 yazma kapısı:** Her yazma için etki tablosu, sunucu tarafı önizle/uygula doğrulaması, audit, cache ve `UserAccessInvalidationService` testleri tamamlanmadan araç açılmaz.

**Çıkış kapısı:** `./mvnw spotless:apply`, `./mvnw test`, ilgili HTTP/MCP entegrasyon testleri, `./mvnw verify`, `git diff --check` ve güvenlik duyarlı değişiklikler için native executable doğrulaması geçer. Sonar analizi push öncesinde veya CI'da çalışır. PRD teslimi kod değişikliği olmadığı için bu kapılar uygulama aşamasına aittir.

## 12. Açık ürün kararları

| Karar | Önerilen varsayılan | Ne zaman kesinleşir? |
| --- | --- | --- |
| İlk istemci desteği | MCP Inspector ile OAuth akışı doğrulandı; Codex ve Claude Code canlı uyumluluğu ayrı kabul testi | Her istemcinin gerçek callback ve araç çağrısı testinden sonra. |
| MCP protokol sürümleri | 2026-07-28 yayımlanmış güncel sürüm; desteklenen eski sürümler uyumluluk matrisinde açıkça belirtilir | SDK güncellemesi ve istemci testleri sonunda. |
| Uzak sunucu dışında `stdio` köprüsü | P0 dışı | Yerel geliştirici kullanım ihtiyacı ölçüldüğünde. |
| P1 yazma araçlarının ilk grubu | Kullanıcı durumu, grup üyeliği, tek oturum iptali | P0 kullanım verisi ve güvenlik incelemesinden sonra. |
| DCR / Client ID Metadata Documents | P0 dışı; ön kayıtlı istemciler yeterli | Çoklu istemci kurulum maliyeti doğrulandığında. |
| Kaynak kod deposu | Aynı Git deposunda ayrı Maven modülü ve bağımsız artifact | Ekip sahipliği veya release temposu ayrı repo gerektirirse. |
| Üretim alan adı | `https://mcp.<kitezh-domain>/mcp` | DNS ve Render custom domain kurulurken. |

## 13. Kaynaklar

- [MCP 2026-07-28 belirtimi](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Streamable HTTP taşıması](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [GitHub MCP Server](https://github.com/github/github-mcp-server), [yapılandırma rehberi](https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md), [Streamable HTTP rehberi](https://github.com/github/github-mcp-server/blob/main/docs/streamable-http.md) ve [yerel OAuth rehberi](https://github.com/github/github-mcp-server/blob/main/docs/oauth-login.md)
- [Grafana MCP Server seçenekleri](https://grafana.com/docs/grafana/latest/developer-resources/mcp/)
- [Grafana MCP Server kurulumu](https://grafana.com/docs/grafana/latest/developer-resources/mcp/set-up/)
- [Grafana MCP Server kaynak kodu ve container kullanımı](https://github.com/grafana/mcp-grafana)
- [SonarQube MCP Server](https://github.com/SonarSource/sonarqube-mcp-server)
- [Keycloak MCP yetkilendirme rehberi](https://github.com/keycloak/keycloak/blob/main/docs/guides/securing-apps/mcp-authz-server.adoc)
- [Keycloak MCP odaklı topluluk örneği](https://github.com/shigechika/keycloak-mcp) ve [geniş yüzey örneği](https://github.com/paoloamato2/keycloak-mcp-server)
