# Kitezh MCP Server PRD

**Durum:** P0 uygulama başlangıcı hazır; ürün kabulü ve üretim yayını tamamlanmadı

**Tarih:** 17 Ekim 2026

**Kapsam:** Tek issuer kullanan Kitezh kurulumu

**Önerilen ilk sürüm:** Ayrı Render Web Service olarak çalışan uzak, salt okunur MCP sunucusu

**Uygulama notu (17 Ekim 2026):** İlk bağımsız `mcp-server/` modülü, read-only on MCP aracı, MCP resource audience ve `mcp.read`, protected resource metadata, RFC 8693 token exchange, ayrı Render servisi, CI kalite işi, tag bazlı yayın akışı, Sonar girdileri ve Grafana dashboard/alert dosyaları eklendi. MCP native build ve release akışı backend ile aynı GraalVM Native Image, UPX ve Jib Native Image extension yapısını kullanır; CI Linux AMD64 ve ARM64 native binary'lerini doğrular, mimariye özel imajları Docker Hub'a basar, multi-architecture manifest'i Render'a dağıtır ve `mcp-server/README-dockerhub.md` açıklamasını günceller. Ana Authorization Server seed kayıtları ve audience/role claim testleri de buna göre güncellendi. MCP doğrulaması Spring AI 2.0.1 ile geçiyor. Bu sürümün getirdiği MCP Java SDK 2.0.0 en fazla `2025-11-25` protokol sürümünü içeriyor; bu nedenle PRD'deki `2026-07-28` hedefi karşılanmış sayılmaz. CI/CD ve Sonar bağlantılarını etkinleştirmek için GitHub secret'ları; Render'da servisi gerçekten çalıştırmak için service secret'ı ve yayın kimlik bilgileri gerekir. MCP Inspector ile gerçek istemci deneyi ve hedef protokol uyumluluğu ürün kabulünden önce tamamlanmalıdır.

## 1. Amaç ve karar

Kitezh MCP Server, yetkili bir operatörün bir MCP istemcisinden Kitezh kimlik ve erişim verilerini sorgulamasını sağlar. İlk sürüm; kullanıcı, grup, istemci, oturum ve denetim kayıtları hakkında güvenilir, sayfalanmış ve kaynak bağlantısı içeren yanıtlar üretir. Yönetim değişiklikleri sonraki aşamada, her işlem için ayrı yetki ve sunucu tarafı onay akışıyla açılır.

**Mimari karar:** Kitezh MCP Server, ana Kitezh uygulamasından ayrı çalışan bir Spring Boot uygulaması ve ayrı bir Render Web Service olacaktır. Dış MCP istemcileri sunucuya ayrı bir genel adres üzerinden bağlanır; önerilen üretim adresi `https://mcp.<kitezh-domain>/mcp`, Render varsayılan adresi ise `https://kitezh-mcp.onrender.com/mcp` biçimindedir. MCP sunucusu Kitezh veritabanına, JPA repository'lerine veya uygulama içi `Admin*Service` sınıflarına doğrudan erişmez. Yalnız sürümlü Kitezh yönetim API'sini çağırır.

Kaynak kodu ilk aşamada aynı Git deposunda bağımsız bir Maven modülü/uygulaması olarak tutulabilir; fakat ayrı artifact, ayrı başlangıç sınıfı, ayrı Docker imajı, ayrı ortam değişkenleri, ayrı sağlık kontrolü ve ayrı Render deploy yaşam döngüsü bulunur. Ana Kitezh uygulaması MCP bağımlılıklarını yüklemez ve `/mcp` endpoint'i yayımlamaz.

**Teknoloji kararı:** Ayrı MCP uygulamasının tool ve Streamable HTTP katmanı için Spring Boot 4.x ile uyumlu **Spring AI 2.x MCP Server WebMVC starter** kullanılacak. Uygulama bir LLM modeli çağırmayacağı için Spring AI'nin model sağlayıcısı, prompt zinciri veya vector store bileşenleri eklenmeyecek. MCP giriş kimlik doğrulaması Spring Security resource server ile yapılır. Kitezh yönetim API'sine kullanıcı adına erişim, OAuth 2.0 Token Exchange ile alınan kısa ömürlü ve `admin-api` audience değerine bağlı ikinci bir token üzerinden yapılır.

MCP sunucusu, modelin çağırabileceği **sınırlı iş araçları** sunar. Genel URL çağırma, SQL çalıştırma, rastgele REST yolu çağırma veya tüm OpenAPI işlemlerini otomatik araçlara dönüştürme yoktur.

## 2. Araştırma ve ürün çıkarımları

| İncelenen sunucu / kaynak | Gözlem | Kitezh kararı |
| --- | --- | --- |
| [GitHub'ın resmi MCP sunucusu](https://github.com/github/github-mcp-server) | Yerel ve uzak kullanım, araç grupları, tekil araç seçimi ve salt okunur mod sunar. | `toolsets`, tekil izin listesi ve sunucu düzeyinde değiştirilemeyen salt okunur sınır. |
| [Grafana'nın resmi MCP sunucusu](https://grafana.com/docs/grafana/latest/developer-resources/mcp/) | Açık kaynak MCP sunucusu Grafana'dan ayrı bir binary/container olarak çalışır ve Grafana API'sine bağlanır; Grafana Cloud ayrıca barındırılan, OAuth tabanlı uzak MCP hizmeti sunar. | Kitezh MCP de ayrı deploy edilir, Kitezh API'sini kullanır ve dış istemciyi kullanıcı adına OAuth ile yetkilendirir. |
| [SonarQube'un resmi MCP sunucusu](https://github.com/SonarSource/sonarqube-mcp-server) | Seçici araç kümeleri ve salt okunur çalışma modu ile ajan bağlamını ve yazma yüzeyini daraltır. | Küçük varsayılan katalog; `read_only=true` olduğunda yazma araçları hiç yayımlanmaz. |
| [Keycloak MCP topluluk örneği: odaklı araçlar](https://github.com/shigechika/keycloak-mcp) | Kullanıcı, istemci, oturum ve olay incelemesi odaklıdır; yazma yetkisi ve grup değişiklikleri ayrıca sınırlandırılır. | İlk sürümde tanılama/inceleme akışlarını öncele; üyelik ve rol değişiklikleri için plan/uygula modeli kullan. |
| [Keycloak MCP topluluk örneği: geniş yüzey](https://github.com/paoloamato2/keycloak-mcp-server) | 299 yönetim API işlemini araç olarak açtığını ve hassas yazma işlemleri için güvenlik uyarısını kendi belgesinde belirtir. | API kataloğunu otomatik dışa aktarma. Her aracı ayrı ürün ve güvenlik incelemesinden geçir. |
| [Keycloak'ın resmi MCP yetkilendirme rehberi](https://github.com/keycloak/keycloak/blob/main/docs/guides/securing-apps/mcp-authz-server.adoc) | Keycloak'ın **MCP için yetkilendirme sunucusu** olarak kullanımı, audience ve istemci kayıt seçeneklerini anlatır. Bu, resmi bir Keycloak yönetim MCP sunucusu anlamına gelmez. | Kitezh'in OAuth sunucusu ile MCP kaynak sunucusunun görevlerini açıkça ayır. |

Protokol hedefi [MCP 2026-07-28 belirtimi](https://modelcontextprotocol.io/specification/2026-07-28) olmalıdır. Spring AI 2.0.1'in bağımlı olduğu MCP Java SDK 2.0.0 yalnızca `2025-11-25` sürümüne kadar protokol sabiti içerir. Mevcut entegrasyon testi `2025-11-25` ile `initialize`, `tools/list`, salt okunur araç işaretleri ve Prometheus metriklerini doğrular. `2026-07-28` desteği SDK/Spring AI sürüm güncellemesi ve MCP Inspector/gerçek istemci doğrulaması tamamlanana kadar açık kabul maddesidir; eski SSE taşıması yeni ürün yüzeyi olarak açılmaz.

## 3. Mevcut Kitezh durumu

- Uygulama tek issuer kullanır; Keycloak realm seçicisine denk çoklu realm sınırı yoktur. MCP araçlarına `realm` parametresi eklenmez.
- Yönetim verileri `/api/admin/**` altında yer alır. Kullanıcı, grup, istemci, oturum, olay ve genel arama uç noktaları ile ayrı `Admin*Service` sınıfları vardır.
- Yönetim API'si JWT issuer/audience doğrulaması, aktif authorization denetimi, DPoP ve `ROLE_*` yetkileri uygular. `whoami` mevcut kullanıcının yetki bayraklarını verir.
- `admin-api` kapsamı, konsol istemcileri ve RFC 8693 token exchange desteği mevcut olmakla birlikte; ayrı MCP resource audience, MCP protected resource metadata, MCP istemci kaydı, ayrı yönetim API resource audience ve MCP → Kitezh token exchange politikası henüz ürün olarak tanımlı değildir. Bunlar MVP ön koşuludur. Var olan konsol token'ı otomatik olarak MCP token'ı kabul edilmez.
- `AuthorizationServerConfig` yönetici rol claim'lerini bugün yalnız `ConsoleClients.ADMIN_CLIENTS` içindeki istemcilere ekler. Token exchange sonucunda üretilen `admin-api` token'ına kullanıcının geçerli yönetim rollerinin, `act`/istemci bağlamının ve oturum/authorization kimliğinin güvenli biçimde eklenmesi gerekir.
- Gruplar, roller veya kullanıcının etkin durumu değiştiğinde mevcut yönetim servislerinin audit ve `UserAccessInvalidationService` davranışı korunmalıdır.

Bu saptamalar 17 Ekim 2026 tarihli çalışma ağacındaki kaynaklardan yapılmıştır; özellikle `AdminApiSecurityConfig`, `ConsoleJwtDecoderFactory`, `AdminWhoAmIController`, ilgili `Admin*Controller` sınıfları ve Liquibase istemci kapsamı verileri incelenmiştir.

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

Araç isimleri ve filtrelerin tam JSON Schema'sı uygulama başlamadan önce `contracts/mcp-tools.json` benzeri sürümlü bir sözleşmede dondurulur. Her araçta `title`, ne zaman kullanılacağına dair kısa açıklama, doğrulanan `inputSchema`, mümkünse `outputSchema`, doğru `readOnlyHint` ve hassas veri sınıfı bulunur. Yapılandırılmış çıktı ile metin özeti birlikte dönebilir; özette gereksiz PII çoğaltılmaz. [MCP araç belirtimi](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) yapılandırılmış çıktı ve şema kurallarını tanımlar.

MVP'de dinamik `resources` ve `prompts` yayımlamak zorunlu değildir. Sonraki aşamada salt okunur, kimliğe göre yetkilendirilmiş `kitezh://...` kaynakları eklenebilir; kaynak URI'sı yetkiyi aşan alternatif bir yol oluşturamaz.

## 7. Yetkilendirme ve güvenlik sözleşmesi

1. **Ayrı kaynak kimliği:** MCP kaynağı kendi genel URI'siyle tanımlanır, örneğin `https://mcp.kitezh.example/mcp`. Gelen token `iss`, `exp`, imza ve bu URI'ye bağlı `aud` açısından MCP servisinde doğrulanır. `admin-api` veya başka bir servis için verilmiş token `/mcp` üzerinde kabul edilmez. MCP belirtimi audience doğrulamasını zorunlu tutar: [MCP Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
2. **Keşif:** MCP kaynağı RFC 9728 Protected Resource Metadata yayımlar; 401 yanıtında `WWW-Authenticate` ile metadata ve asgari kapsamı bildirir. Kitezh yetkilendirme sunucusu OIDC/OAuth metadata üzerinden keşfedilir. Eksik kapsamda 403 ve gerekli kapsam bilgisi döner.
3. **İstemci kaydı:** P0'da bilinen MCP istemcileri Kitezh Authorization Server'a yönetici tarafından ön kaydedilir; Authorization Code + PKCE S256 ve kesin redirect URI listesi kullanılır. DCR veya Client ID Metadata Documents desteği, SSRF/redirect/istemci politikaları ve kullanılan istemci uyumluluğu ayrı tasarlanıp P1 sonrası değerlendirilebilir. `client_credentials` insan adına yönetim için kullanılmaz.
4. **Kapsam ve rol:** Yeni `mcp.read` kapsamı MCP giriş iznidir; gerçek nesne/işlem yetkisi mevcut `ROLE_*` ve servis kontrollerinden gelir. P1 için ayrı `mcp.write` gerekir. `mcp.write`, rol yetkisinin yerine geçmez.
5. **Token exchange ve audience ayrımı:** MCP servisi gelen MCP token'ını Kitezh yönetim API'sine iletmez. Her araç çağrısı için veya güvenli kısa süreli cache süresince Kitezh token endpoint'inde RFC 8693 Token Exchange yapar. Subject token gelen kullanıcı token'ıdır; MCP servisinin confidential client kimliği actor olarak doğrulanır; hedef `audience=admin-api`, kapsam `admin-api` olur. Dönen token kullanıcının güncel rollerini, oturum/authorization bağını ve MCP actor bilgisini taşır. Bu token yalnız Kitezh yönetim API'sinde kabul edilir.
6. **Yetkinin kaynağı:** MCP servisi araç listesini kullanıcı bağlamına göre daraltabilir; fakat nihai authorization kararı her Kitezh API çağrısında `AdminApiSecurityConfig` ve servis katmanında verilir. MCP tarafındaki kontrol tek başına güvenlik sınırı değildir.
7. **İptal:** Kullanıcı kapatılması, yetki veya grup değişikliği, oturum/token iptali sonraki MCP çağrısında geçerli olmalıdır. Token exchange ve Kitezh API decoder'ı mevcut aktif authorization/revocation denetimini uygular. Exchange sonucu token kısa ömürlüdür; yetki kararı uzun süre cache'lenmez.
8. **Servis kimliği:** MCP → Kitezh token exchange için kullanılan confidential client sırrı yalnız Render secret olarak tutulur. Loglara, istemci yanıtına veya repoya yazılmaz. Bu servis kimliği tek başına yönetim yetkisi vermez; kullanıcı subject token'ı ve onun rolleri zorunludur.
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
- Varsayılan araç listesi yalnız P0 kataloğudur. `app.mcp.toolsets` ve `app.mcp.read-only` sunucu ayarları dağıtımda sabitlenir; istemci üst sınırı artıramaz.
- Gözlemlenebilirlik: MCP servisinde Micrometer/Actuator üzerinden çağrı sayısı, 401/403, token exchange hatası, downstream süre/hata, araç hatası ve çıktı boyutu izlenir. `traceparent` ve correlation ID Kitezh API'ye aktarılır. MCP erişim kaydı ile Kitezh audit kaydı aynı iz kimliği üzerinden ilişkilendirilir; gizli veri eklenmez.

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
- Asgari ortam değişkenleri: `KITEZH_ISSUER`, `KITEZH_API_BASE_URL`, `KITEZH_MCP_PUBLIC_URL`, `KITEZH_MCP_CLIENT_ID`, secret olarak `KITEZH_MCP_CLIENT_SECRET`, etkin toolset'ler ve salt okunur modu. Secret değerler Render ortamında tutulur.
- Production'da özel alan adı önerilir. Render'ın `onrender.com` adresi geliştirme/pilot için kullanılabilir; OAuth resource ve redirect kayıtları kullanılan gerçek genel adresle birebir eşleşir.
- MCP servisi erişilemez olduğunda ana Kitezh login ve yönetim uygulaması çalışmaya devam eder. Kitezh API erişilemez olduğunda MCP sunucusu sınırlı süre içinde `upstream_unavailable` döner; eski veri sunmaz.

## 10. Kabul senaryoları

| Kimlik / istek | Beklenen sonuç |
| --- | --- |
| Token yok | `/mcp` 401 ve protected resource keşif bilgisi. |
| Geçerli `admin-api` audience token'ı | 401; MCP kaynağına yönelik token gerekir. |
| `mcp.read` var, `ROLE_USER_QUERY` var | Kullanıcı araması çalışır; yetki dışı detay aracı listede görünmez ve çağrısı 403 döner. |
| MCP token'ının doğrudan Kitezh yönetim API'sine gönderilmesi | 401; `admin-api` audience gerekir. |
| Token exchange'te MCP servis kimliği veya subject token geçersiz | Araç çağrısı başarısız olur; Kitezh API çağrılmaz ve gizli ayrıntı döndürülmez. |
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

1. **Protokol ve istemci deneyi:** Spring AI 2.x MCP Server WebMVC starter'ının 2026-07-28 desteğini, stateless HTTP davranışını, `tools/list` ve `tools/call` şemasını MCP Inspector ve seçilen gerçek istemciyle kanıtla. Spring AI MCP security modülünün OAuth metadata ve audience doğrulamasıyla uyumunu kontrol et. Sürüm uyumsuzluğu varsa desteklenen sürümü açıkça belgeleyip geriye uyum planı çıkar.
2. **OAuth temeli:** MCP resource metadata, ayrı MCP audience, `mcp.read`, PKCE'li ön kayıtlı istemci ve 401/403 akışını ekle. Ardından dedicated `admin-api` resource audience, confidential MCP service client ve kullanıcı adına token exchange politikasını ekle. Liquibase başlangıç verisi ve güvenlik testleri aynı iş paketinde olsun.
3. **Yönetim API sözleşmesi:** MCP'nin ihtiyaç duyduğu salt okunur yönetim endpoint'lerinin DTO, sayfalama, OpenAPI ve hata sözleşmesini dondur. MCP servisinin kullanamayacağı hassas alanları API yanıtından çıkar veya ayrı güvenli DTO ile sınırla.
4. **Salt okunur katalog:** P0 araçlarını tipli `KitezhAdminApiClient` üzerinden uygula. Her araç için yetkili/yetkisiz, boş sayfa, bulunamadı, upstream hata ve hassas alan senaryolarını kapsa.
5. **Render dağıtımı:** Ayrı Docker artifact'ı, Render Web Service/Blueprint tanımı, health check, aynı bölge/private network bağlantısı, custom domain, secret'lar ve bağımsız deploy/rollback rehberi ekle.
6. **İşletim:** HTTPS/Origin sınırı, metrik/audit/trace korelasyonu, örnek istemci kurulumu ve yerel/üretim bağlantı rehberi.
7. **P1 yazma kapısı:** Her yazma için etki tablosu, sunucu tarafı önizle/uygula doğrulaması, audit, cache ve `UserAccessInvalidationService` testleri tamamlanmadan araç açılmaz.

**Çıkış kapısı:** `./mvnw spotless:apply`, `./mvnw test`, ilgili HTTP/MCP entegrasyon testleri, `./mvnw verify`, `git diff --check` ve güvenlik duyarlı değişiklikler için native executable doğrulaması geçer. Sonar analizi push öncesinde veya CI'da çalışır. PRD teslimi kod değişikliği olmadığı için bu kapılar uygulama aşamasına aittir.

## 12. Açık ürün kararları

| Karar | Önerilen varsayılan | Ne zaman kesinleşir? |
| --- | --- | --- |
| İlk istemci desteği | MCP Inspector + bir ön kayıtlı masaüstü istemci | Protokol deneyi sonunda. |
| Eski MCP sürümleri | 2026-07-28 hedef; 2025-11-25 yalnız gerçek istemci gereksinimi varsa | SDK ve istemci uyumluluk testi sonunda. |
| Uzak sunucu dışında `stdio` köprüsü | P0 dışı | Yerel geliştirici kullanım ihtiyacı ölçüldüğünde. |
| P1 yazma araçlarının ilk grubu | Kullanıcı durumu, grup üyeliği, tek oturum iptali | P0 kullanım verisi ve güvenlik incelemesinden sonra. |
| DCR / Client ID Metadata Documents | P0 dışı; ön kayıtlı istemciler yeterli | Çoklu istemci kurulum maliyeti doğrulandığında. |
| Kaynak kod deposu | Aynı Git deposunda ayrı Maven modülü ve bağımsız artifact | Ekip sahipliği veya release temposu ayrı repo gerektirirse. |
| Üretim alan adı | `https://mcp.<kitezh-domain>/mcp` | DNS ve Render custom domain kurulurken. |

## 13. Kaynaklar

- [MCP 2026-07-28 belirtimi](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [GitHub MCP Server](https://github.com/github/github-mcp-server) ve [yapılandırma rehberi](https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md)
- [Grafana MCP Server seçenekleri](https://grafana.com/docs/grafana/latest/developer-resources/mcp/)
- [Grafana MCP Server kurulumu](https://grafana.com/docs/grafana/latest/developer-resources/mcp/set-up/)
- [Grafana MCP Server kaynak kodu ve container kullanımı](https://github.com/grafana/mcp-grafana)
- [SonarQube MCP Server](https://github.com/SonarSource/sonarqube-mcp-server)
- [Keycloak MCP yetkilendirme rehberi](https://github.com/keycloak/keycloak/blob/main/docs/guides/securing-apps/mcp-authz-server.adoc)
- [Keycloak MCP odaklı topluluk örneği](https://github.com/shigechika/keycloak-mcp) ve [geniş yüzey örneği](https://github.com/paoloamato2/keycloak-mcp-server)
