// Vercel Speed Insights initialization
(function() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') return;
  
  // Initialize the queue for Speed Insights
  if (!window.si) {
    window.si = function a(...params) {
      window.siq = window.siq || [];
      window.siq.push(params);
    };
  }
  
  // Inject the Speed Insights script
  const script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  script.dataset.sdkn = '@vercel/speed-insights';
  script.dataset.sdkv = '2.0.0';
  
  script.onerror = function() {
    console.log('[Vercel Speed Insights] Failed to load script. Please check if any content blockers are enabled and try again.');
  };
  
  document.head.appendChild(script);
})();
