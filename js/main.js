// Header: スクロールで背景色を付与
const header = document.getElementById('header');
// 下層ページ（.is-fixed）は常に背景色ありのまま
const onScroll = () => header.classList.toggle('is-scrolled', header.classList.contains('is-fixed') || window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ハンバーガーメニュー（スマホ）
const toggle = document.getElementById('navToggle');
const nav = document.getElementById('globalNav');

const setMenu = (open) => {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  nav.classList.toggle('is-open', open);
  document.body.classList.toggle('is-locked', open);
};

toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));

// お問い合わせフォーム（Formspreeへ非同期送信）
const form = document.getElementById('contactForm');

if (form) {
  const submitBtn = document.getElementById('contactSubmit');
  const status = document.getElementById('contactStatus');

  const showStatus = (message, type) => {
    status.textContent = message;
    status.className = `form__status is-${type}`;
  };

  // 入力し直したらエラー表示を消す
  form.addEventListener('input', (e) => {
    if (e.target.checkValidity()) e.target.closest('.form__row')?.classList.remove('is-error');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const invalid = [...form.elements].filter((el) => el.willValidate && !el.checkValidity());
    form.querySelectorAll('.form__row.is-error').forEach((row) => row.classList.remove('is-error'));
    if (invalid.length) {
      invalid.forEach((el) => el.closest('.form__row')?.classList.add('is-error'));
      invalid[0].focus();
      showStatus('未入力または正しくない項目があります。ご確認ください。', 'error');
      return;
    }

    if (form.action.includes('YOUR_FORM_ID')) {
      showStatus('フォームの送信先が未設定です（管理者向け：FormspreeのフォームIDを設定してください）。', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '送信中…';
    showStatus('', 'info');

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      form.reset();
      showStatus('送信が完了しました。担当者より2営業日以内にご連絡いたします。', 'success');
    } catch (err) {
      showStatus('送信に失敗しました。時間をおいて再度お試しいただくか、メールにてお問い合わせください。', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '送信する';
    }
  });
}
