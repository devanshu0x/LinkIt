import FileTransfer from "../components/FileTransfer"


function LandingPage() {
  return (
    <div className="my-8 sm:my-14 mx-6 sm:mx-10 " >
        <h1 className="text-3xl sm:text-4xl md:text-6xl text-center  font-bungee">
            <span className="text-accent" >
                Link  
            </span>
            <span >
                It
            </span>
        </h1>
        <h4 className="text-center text-lg sm:text-xl md:text-2xl my-2 md:my-4 text-text-muted">
          Share files from peer to peer securely
        </h4>

        <div className="my-18">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div><FileTransfer/>
            </div>
            <div></div>
          </div>
        </div>

    </div>
  )
}

export default LandingPage