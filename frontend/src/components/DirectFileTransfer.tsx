

function DirectFileTransfer() {
  return (
    <div className="px-4 pt-7  ">
        <div className="relative overflow-hidden h-9 mb-8 ">
        <div className="h-4 w-4 rounded-full bg-text hover:bg-accent-secondary duration-300 transition-colors absolute left-0 top-0" />
        <div className="h-4 w-4 rounded-full bg-text hover:bg-accent-secondary duration-300 transition-colors absolute right-0 top-0" />
        <div className="h-4 w-4 rounded-full bg-accent absolute animate-movex" />
      </div>
    </div>
  )
}

export default DirectFileTransfer