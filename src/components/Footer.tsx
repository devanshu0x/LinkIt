
function Footer() {
  return (
    <div className="py-4 px-6 bg-black/30 shadow-[0_-1px_6px_2px_rgba(0,0,0,0.4)] flex justify-end items-center gap-3">
      <h6>Reach out to me</h6>
      <a
        href="https://github.com/devanshu0x"
        target="_blank"
        rel="noopener noreferrer"
        className="text-text hover:text-accent transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6"
        >
          <path d="M12 0C5.37 0 0 5.37 0 12a12 12 0 008.21 11.39c.6.11.82-.26.82-.58 0-.29-.01-1.06-.02-2.09-3.34.73-4.04-1.61-4.04-1.61-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.73.08-.73 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.4 1.23-3.25-.12-.3-.53-1.52.12-3.16 0 0 1-.32 3.3 1.23a11.52 11.52 0 016 0C17 3.58 18 3.9 18 3.9c.65 1.64.24 2.86.12 3.16.77.85 1.23 1.93 1.23 3.25 0 4.63-2.8 5.66-5.47 5.96.43.37.81 1.1.81 2.22 0 1.6-.02 2.89-.02 3.28 0 .32.22.69.82.58A12 12 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </a>

      <a
        href="https://x.com/devanshu_twt"
        target="_blank"
        rel="noopener noreferrer"
        className="text-text hover:text-accent transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 24 24"
          className="w-6 h-6"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.5 11.24H15.32l-5.3-6.934L3.81 21.75H.5l7.73-8.843L.25 2.25h8.18l4.79 6.256 5.02-6.256zm-1.16 17.5h1.83L7.12 4.29H5.17l11.91 15.46z" />
        </svg>
      </a>
    </div>
  );
}

export default Footer;
