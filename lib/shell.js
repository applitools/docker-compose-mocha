function getShell() {
  const path = process.env.USE_SHELL;
  if (path === 'NO') {
    return undefined;
  }
  if (path) {
    return path;
  }
  return '/bin/zsh';
}

module.exports = getShell;
