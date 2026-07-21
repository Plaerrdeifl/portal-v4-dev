(() => {
  const params = new URLSearchParams(location.search);

  if (
    params.has("code")
    || params.has("error")
    || params.has("error_description")
  ) {
    document.documentElement.dataset.oauthReturn = "true";
  }
})();
