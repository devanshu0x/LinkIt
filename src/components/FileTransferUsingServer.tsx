
function FileTransferUsingServer() {
  return (
    <div className="px-4 pt-8">
      <div className="">
        <div className="relative h-30">
        <div className="h-4 w-4 rounded-full bg-text hover:bg-accent-secondary duration-300 transition-colors absolute left-0 top-0" />
        <div className="h-4 w-4 rounded-full bg-text hover:bg-accent-secondary duration-300 transition-colors absolute right-0 top-0" />
        <div className="h-5 w-5 rounded-full bg-text hover:bg-accent-secondary duration-300 transition-colors absolute left-[50%] bottom-0"></div>
        <div className="h-5 w-5 absolute left-[50%] bg-text hover:bg-accent-secondary duration-300 transition-colors"></div>

        <div className="h-4 w-4 rounded-full bg-accent -z-1 absolute animate-firstT" />
        <div className="h-4 w-4 rounded-full bg-accent -z-1 absolute animate-secondT" />
        <div className="h-4 w-4 rounded-full bg-accent -z-1 absolute animate-thirdT" />
        <div className="absolute left-[48%] -top-8">Server</div>
        <div className="absolute left-[45%] -bottom-8">Database</div>
      </div>
    </div>
    </div>
  )
}

export default FileTransferUsingServer