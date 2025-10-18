function FileTransfer() {
  return (
    <>
      {/* File transfer using server */}
      <div className="relative h-30 mb-18">
        <div className="h-4 w-4 rounded-full bg-text absolute left-0 top-0" />
        <div className="h-4 w-4 rounded-full bg-text absolute right-0 top-0" />
        <div className="h-5 w-5 rounded-full bg-text absolute left-[50%] bottom-0"></div>
        <div className="h-5 w-5 absolute left-[50%] bg-text"></div>

        <div className="h-4 w-4 rounded-full bg-accent -z-1 absolute animate-firstT" />
        <div className="h-4 w-4 rounded-full bg-accent -z-1 absolute animate-secondT" />
        <div className="h-4 w-4 rounded-full bg-accent -z-1 absolute animate-thirdT" />

        <div className="absolute left-0 -top-7">Alice</div>
        <div className="absolute right-0 -top-7">Bob</div>
        <div className="absolute left-[47%] -top-7">Server</div>
        <div className="absolute left-[46%] -bottom-7">Database</div>
      </div>
      <div className="mb-16">
        <h4 className="text-center text-lg">File transfer using server</h4>
      </div>

      {/* Direct file transfer */}
      <div className="relative overflow-hidden h-9 mb-8 ">
        <div className="h-4 w-4 rounded-full bg-text absolute left-0 top-0" />
        <div className="h-4 w-4 rounded-full bg-text absolute right-0 top-0" />

        <div className="h-4 w-4 rounded-full bg-accent -z-1 absolute animate-movex" />
      </div>
      <div>
        <h4 className="text-center text-lg">Direct File transfer</h4>
      </div>
    </>
  );
}

export default FileTransfer;
