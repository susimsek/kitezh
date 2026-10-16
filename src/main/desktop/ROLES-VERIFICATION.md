# Yerel desktop rol yönetimi doğrulaması

14 Ekim 2026, Windows / Electron 44.5.1. Değişiklikler yalnızca `src/main/desktop` altındadır. Mevcut kullanıcı ekranları ve diğer çalışma ağacı değişiklikleri korunmuştur.

## Tamamlanan desktop davranışı

- Kompakt rol tablosu, monospace rol bağlantısı, açıklama, klavye/Escape destekli işlem menüsü ve başlıktaki oluşturma eylemi. `ROLE_ADMIN` ve `ROLE_USER` korumalıdır; silme sunulmaz. Sayfa açıklaması web sözlüğüyle eşleşir.
- 300 ms arama, eski yanıtları yok sayan istek nesilleri, arama odağının korunması, A–Z/Z–A sıralama, kayıt sayısı, aktif filtre/temizleme, 10/20/50/100 boyutları ve dört sayfa kontrolü. İlk boyut 10'dur. Silme sonrası toplamlar tekrar yüklenir; boşalan son sayfadan önceki sayfaya dönülür.
- Ayrı yerel rol detay state'i, breadcrumb, kullanıcı sayısı, korumalı rozet ve Ayrıntılar / Roldaki kullanıcılar sekmeleri. Listeye dönüşte arama/sıralama/boyut/sayfa korunur. Kullanıcı detayından role geri dönülebilir.
- Üç satırlı, 500 karakter sınırlı açıklama alanı; alan altı doğrulama, yardım metni, boş açıklama için `null`, disket ikonu ve bekleme spinner'ı. Mevcut PUT sözleşmesi korunur; başarılı kaydetme PUT yanıtıyla gösterilir.
- Mevcut global/istemci bileşik rol POST/DELETE handler'ları korunur. Bölümler açıklamadan sonra global roller / istemci rolleri sırasındadır. Aday arama → seçim → Ata akışı iki karakter, debounce, eski yanıt koruması, bekleme/boş sonuç/hata durumlarını destekler. Kaldırma onay gerektirir.
- Atanmış kullanıcı tablosu, aday araması/seçimi, mevcut üyelerin adaylardan çıkarılması, etkinlik filtresi, kullanıcı adı/e-posta sıralaması, arama/temizleme ve tam sayfalama. Atama/kaldırma sonrası üyeler ve başlık sayısı tekrar yüklenir. Yükleme hataları boş listeye çevrilmez.
- Sorgusuz detay GET izni korunur. Filtreli detay GET, available-users GET, users POST ve users/{id} DELETE için dar izinler eklenmiştir. Rol adı, pozitif güvenli kullanıcı ID'si, sayfa sınırları, parametre tekrarları, izinli sıralamalar ve yalnızca `{ userId }` gövdesi doğrulanır. Açıklama/silme handler'ları da `manageRoles` kontrol eder.
- Oluşturma formunda breadcrumb, başlangıç odağı, `ROLE_AUDITOR` örneği, yardım metni, textarea, ikonlar ve alan hataları vardır. Başarıda yeni rol detayına gidilir.
- Türkçe/İngilizce, açık/koyu tema, yerel ikonlar, spinner sırasında değişmeyen etiketler, salt okunur erişim ve rol ekranlarına özgü dar pencere düzeni korunur. Web bileşeni veya React-Bootstrap taşınmamıştır.

## Gerçek metadata

Admin ile gerçek PKCE girişinden sonra Electron'un API köprüsünden alınan yanıt:

```json
{
  "content": ["...10 rol..."],
  "page": { "size": 10, "number": 0, "totalElements": 14, "totalPages": 2 }
}
```

Eski ekran `number` / `totalPages` alanlarını üst düzeyden okuyordu. `test/fixtures/role-page.json` gerçek yanıttan alınmıştır; testler bu iç içe metadata'yı kullanır.

## Kontroller

| Kontrol                               | Sonuç                                                                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                      | Geçti                                                                                                                                                                                                                                    |
| `pnpm test`                           | 157/157 geçti                                                                                                                                                                                                                            |
| `pnpm build`                          | Geçti                                                                                                                                                                                                                                    |
| `git diff --check`                    | Geçti                                                                                                                                                                                                                                    |
| `pnpm package`                        | Windows NSIS, portable ve AppX üretildi; yerel paket üretimi yayın veya imza doğrulaması değildir                                                                                                                                        |
| Odaklı Electron bileşik rol E2E       | Geçti; gerçek Electron / fixture API                                                                                                                                                                                                     |
| Tam `e2e/electron.test.mjs`           | İlk tur: 27 geçti, 3 başarısız, 1 atlandı. Rol testinin değerlendirme callback'i düzeltildikten sonra odaklı tekrar geçti. Diğer iki başarısızlık kullanıcı arama düğmesini bekleyen eski senaryo ve ayarlar penceresinde zaman aşımıdır |
| `node --test e2e/roles-live.test.mjs` | Gerçek backend kontrolleri çalıştı; aşağıdaki backend tutarsızlıkları nedeniyle başarısız kalır                                                                                                                                          |

Canlı test OS callback teslimini gizli OAuth penceresiyle taklit eder; giriş, PKCE, token kasası, IPC ve API istekleri gerçektir. Tüm test pencereleri gizlidir. Admin'in rolü/üyelikleri değiştirilmemiştir. Oluşturulan geçici rol, alt rol, istemci rolü ve kullanıcılar `finally` içinde temizlenir.

Canlı olarak liste, iki detay sekmesi, oluşturma, arama/odak, sıralama, sayfalama, açıklama PUT'u, global/istemci bileşik POST/DELETE, kullanıcı filtreleri, kullanıcı detayına geçiş, kullanıcı rolünü kaldırma, korumalı rol ve ayrı `ROLE_USER_MANAGER` oturumuyla salt okunur rol erişimi çalıştırılmıştır. Atama uç noktası 500 verdiğinde kaldırma kontrolü için ayrı bir geçici kullanıcı **kullanıcı oluşturma API'sinde** test rolüne atanmıştır; bu, rol atama POST'unun başarılı olduğu anlamına gelmez.

Dar pencere / %200 yakınlaştırmada son ölçüm 373 CSS piksel viewport ve 365 piksel belge genişliğidir; yatay sayfa taşması yoktur. Açık/koyu ve Türkçe/İngilizce ekran görüntüleri alınmıştır. macOS/Linux ve gerçek Windows sistem teması geçişi bu Windows turunda doğrulanmamıştır. Yerel portable EXE'nin Authenticode durumu `NotSigned` olarak okunmuştur.

## Backend kaynaklı kalan engeller

1. Açıklama PUT'u 200 ve yeni açıklamayı döndürüyor; sonraki detay GET'i eski açıklamayı döndürüyor.
2. İstemci bileşik rol POST'u 200 ve eklenen ilişkiyi döndürüyor; sonraki GET bu ilişkiyi içermiyor.
3. Global alt rol DELETE'i 200 ve boş alt rol koleksiyonu döndürüyor; sonraki GET eski alt rolü içeriyor.
4. `POST /api/admin/roles/{temporaryRole}/users`, geçerli `{ "userId": temporaryUserId }` gövdesiyle HTTP 500 `internal_error` döndürüyor. Desktop hata bildirimini gösteriyor. Ayrı geçici üyelikte kullanıcı rolü DELETE'i 200 ve `userCount: 0` döndürüyor.

Bu sonuçlar mock test başarısı olarak geçiştirilmez. Canlı E2E tüm ekran kontrollerinden sonra backend tutarlılık listesinin boş olmasını bekler ve bu dört engel varsa başarısız olur. Backend değişikliği izin verilen kapsamın dışındadır; nedenin belirli bir cache/transaction uygulamasından kaynaklandığı henüz doğrulanmamıştır.

Yerel kanıtlar `e2e/artifacts/roles-live/` altındadır: `roles-response.json`, `description-consistency.json`, `client-composite-consistency.json`, `mutations.json`, `backend-limitations.json` ve ekran PNG'leri. Bunlar yeniden üretilebilir, Git'e alınmayan test çıktılarıdır.
