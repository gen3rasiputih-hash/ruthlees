# RUTHLEES

Aplikasi bookmark manhwa pribadi berbasis HTML, CSS, JavaScript, dan Supabase.

## Fitur versi awal

- Login email/password menggunakan Supabase Auth (tanpa pendaftaran di website).
- Daftar bookmark dari tabel `public.manhwa`.
- Tambah, edit, dan hapus manhwa.
- Simpan URL cover dan URL tempat membaca.
- Catat chapter terakhir, total chapter, status, rating, dan catatan.
- Cari judul/catatan dan filter status.
- Tombol cepat `+1 chapter`.
- Tampilan dark mode responsif untuk HP dan komputer.

## 1. Hubungkan ke Supabase

1. Buka `config.js`.
2. Isi `supabaseUrl` dengan Project URL dari Supabase.
3. Isi `supabaseKey` dengan **Publishable key** (biasanya berawalan `sb_publishable_`). Untuk proyek lama, `anon` public key juga dapat digunakan.
4. Jangan masukkan `sb_secret_` atau `service_role` key.

Contoh format (gunakan nilai proyekmu sendiri):

```js
window.RUTHLEES_CONFIG = {
  supabaseUrl: "https://PROJECT-REF.supabase.co",
  supabaseKey: "sb_publishable_xxxxxxxxx"
};
```

Publishable key memang digunakan di browser. Keamanan data harus ditegakkan oleh RLS dan kebijakan database; secret/service-role key tidak boleh berada di frontend.

## 2. Pastikan database siap

Tabel `public.manhwa` harus memiliki kolom berikut:

- `id` uuid primary key
- `user_id` uuid references `auth.users(id)`
- `title` text
- `cover_url` text
- `reading_url` text
- `current_chapter` numeric
- `total_chapters` numeric
- `status` text
- `rating` integer
- `notes` text
- `created_at` timestamptz
- `updated_at` timestamptz

Aktifkan RLS dan pastikan terdapat policy SELECT, INSERT, UPDATE, DELETE untuk `authenticated` dengan syarat `auth.uid() = user_id`. Untuk insert, default `user_id` disarankan `auth.uid()` agar aplikasi tidak mengirim user_id sendiri.

SQL kebijakan yang dibuat pada tahap sebelumnya sudah mencakup pengaturan ini. Jangan hapus atau menonaktifkan RLS.

## 3. Batasi untuk satu akun

Di Supabase Dashboard, buka Authentication > Settings (atau Sign In / Providers, sesuai tampilan dashboard) lalu nonaktifkan **Allow new users to sign up**. Pastikan akun pemilik sudah ada dan dapat login. Jangan menyediakan kredensial akun kepada orang lain.

Catatan: RLS membatasi setiap pengguna ke baris miliknya. Menonaktifkan pendaftaran menjaga aplikasi tetap satu akun. Jika suatu saat kamu mengaktifkan pendaftaran lagi, akun Supabase lain dapat membuat akun tetapi tidak dapat membaca baris milikmu melalui policy tersebut.

## 4. Jalankan lokal

Jangan membuka `index.html` langsung dengan `file://` karena sesi dan request browser lebih dapat diprediksi melalui server lokal.

Pilihan sederhana:

- VS Code: pasang ekstensi Live Server, lalu klik kanan `index.html` > Open with Live Server.
- Atau gunakan Python dari folder proyek:

```bash
python -m http.server 8000
```

Buka `http://localhost:8000`.

## 5. Deploy ke GitHub Pages

1. Buat repository GitHub bernama `ruthlees`.
2. Upload `index.html`, `styles.css`, `app.js`, `config.js`, dan `.nojekyll` ke root repository.
3. Buka Settings > Pages.
4. Pada Build and deployment, pilih Deploy from a branch.
5. Pilih branch `main` dan folder `/ (root)`, lalu Save.
6. Buka URL Pages yang diberikan GitHub.
7. Di Supabase Authentication > URL Configuration, tambahkan URL website GitHub Pages ke Redirect URLs (berguna bila nanti memakai alur email/redirect). Login email/password langsung tidak memerlukan redirect khusus.

Penting: GitHub Pages adalah hosting statis dan situsnya dapat diakses publik. Jangan unggah password, database secret, atau service-role key. File `config.js` mengandung publishable key yang boleh diketahui publik, dengan syarat RLS benar.

## Troubleshooting

### Tombol masuk nonaktif / konfigurasi belum lengkap
Periksa `config.js`; pastikan URL dan Publishable key sudah diisi dan tidak ada spasi/karakter kutip yang hilang.

### Login berhasil tetapi koleksi gagal dimuat
Periksa:
- Nama tabel adalah `public.manhwa`.
- Data API aktif/mengekspos schema `public`.
- Hak akses `authenticated` memiliki SELECT, INSERT, UPDATE, DELETE.
- RLS aktif dan empat policy tersedia.

### Gagal menyimpan dengan pesan permission denied
Periksa `GRANT` untuk role `authenticated`, policy INSERT/UPDATE, dan default `user_id = auth.uid()`.

### Cover tidak muncul
Gunakan URL gambar langsung yang dapat dibuka tanpa login dan diawali `https://` atau `http://`. Sebagian situs melarang hotlink; gunakan URL gambar dari sumber yang mengizinkan penayangan eksternal.

## Catatan keamanan

- `config.js` tidak boleh berisi secret key atau service-role key.
- Jangan menonaktifkan RLS.
- Jangan mengandalkan tampilan login sebagai satu-satunya keamanan; RLS di database adalah pengaman data utama.
- Untuk satu akun, nonaktifkan signups di pengaturan Supabase Auth.
