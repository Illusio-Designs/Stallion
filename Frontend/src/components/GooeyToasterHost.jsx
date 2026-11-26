'use client';
import React, { useEffect } from 'react';
import { GooeyToaster, gooeyToast } from 'goey-toast';
import 'goey-toast/styles.css';
import { attachToastSink } from '../services/toastQueue';

// The toast library lives in this file only, so it is loaded after the page is up (see
// ToastContainerProvider) and not with the first scripts. Notifications asked for in the
// meantime wait in services/toastQueue and are shown as soon as this is mounted.
const GooeyToasterHost = (props) => {
  useEffect(() => attachToastSink((type, title, options) => gooeyToast[type](title, options)), []);
  return <GooeyToaster {...props} />;
};

export default GooeyToasterHost;
