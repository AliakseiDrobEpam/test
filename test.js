function move(speed: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const div = document.getElementById('myDiv') as HTMLDivElement | null;
    if (!div) {
      reject(new Error('Div with id "myDiv" not found'));
      return;
    }

    // Get the width of the viewport and the div
    const screenWidth: number = window.innerWidth;
    const divWidth: number = div.offsetWidth;

    // Starting position
    div.style.position = 'absolute';
    div.style.left = '0px';

    // Target position (right edge minus div width)
    const target: number = screenWidth - divWidth;

    // Calculate duration based on speed (pixels per second)
    const duration: number = (target / speed) * 1000; // ms
    const start: number = performance.now();

    function animate(now: number): void {
      const elapsed: number = now - start;
      const progress: number = Math.min(elapsed / duration, 1);
      div.style.left = `${progress * target}px`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve(duration / 1000); // return time in seconds
      }
    }

    requestAnimationFrame(animate);
  });
}

move(300).then((time: number) => {
  console.log(`Moved in ${time} seconds`);
}).catch((error: Error) => {
  console.error(error.message);
});
