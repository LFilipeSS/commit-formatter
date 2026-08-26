window.pickFolderCompat = async function (btn) {
  if (!('showDirectoryPicker' in window)) {
    alert('Este navegador não permite selecionar pastas locais. Abra o site no Google Chrome ou Microsoft Edge.');
    return;
  }
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;"></span>';
  try {
    if (window.restoreSavedDirectoryPermission) {
      const restored = await window.restoreSavedDirectoryPermission();
      if (restored) return;
    }
    window.selectedDirectoryCompat = await window.showDirectoryPicker({
      id: 'commit-formatter-projects',
      mode: 'read',
    });
    document.getElementById('basePath').value = window.selectedDirectoryCompat.name;
    window.dispatchEvent(new CustomEvent('commit-formatter:folder-selected', {
      detail: { handle: window.selectedDirectoryCompat },
    }));
  } catch (error) {
    if (error.name !== 'AbortError') alert('Erro ao abrir seletor de pasta: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
};

if (!('showDirectoryPicker' in window)) {
  const notice = document.getElementById('browserNotice');
  notice.classList.add('unsupported');
  notice.innerHTML = '<div><strong>Navegador não compatível.</strong><br>Abra este site no Google Chrome ou Microsoft Edge. A prévia interna do Codex não consegue acessar pastas locais.</div>';
}
