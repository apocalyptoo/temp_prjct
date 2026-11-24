// For a "Try again" button after a failed load. When the backend can't be reached, the
// new try can fail within milliseconds: the spinner would come and go unseen, and the
// button would look dead. So for TRY_AGAIN_MS after the tap, `trying` stays true and the
// spinner is shown instead of the error, even if the try has already failed. A success
// never waits: what loaded replaces the spinner at once.
//   const { trying, tryAgain } = useTryAgain(onRetry);
// A second tap while trying does nothing.
import { useCallback, useEffect, useRef, useState } from 'react';

export const TRY_AGAIN_MS = 600;

export function useTryAgain(onRetry) {
  const [trying, setTrying] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const tryAgain = useCallback(() => {
    if (timer.current !== null) return;
    setTrying(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setTrying(false);
    }, TRY_AGAIN_MS);
    onRetry();
  }, [onRetry]);

  return { trying, tryAgain };
}
