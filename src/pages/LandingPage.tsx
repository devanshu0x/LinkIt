import { NavLink } from "react-router-dom";
import DirectFileTransfer from "../components/DirectFileTransfer";
import FileTransferUsingServer from "../components/FileTransferUsingServer";

function LandingPage() {
  return (
    <div className="my-8 sm:my-14 mx-6 sm:mx-10 overflow-clip  ">

      <div className="h-64 w-64 rounded-full bg-transparent md:bg-accent/10 absolute -top-10 -left-22 animate-glow"/>
      <div className="h-82 w-82 rounded-full bg-transparent md:bg-accent/10 absolute top-8 -right-22 animate-glow"/>
      
      <h1 className="text-5xl sm:text-6xl text-center  font-bungee">
        <span className="text-accent">Link</span>
        <span>It</span>
      </h1>
      <h4 className="text-center text-xl sm:text-2xl md:text-3xl my-2 md:my-4 text-text-muted">
        Share files from <span className="text-accent-secondary">peer</span> to <span className="text-accent-secondary">peer</span> securely
      </h4>

      <div className="my-18">
        <div className="flex justify-center items-center">
          <NavLink
            to={"/dashboard"}
            className="px-5 sm:px-8 py-3 bg-accent hover:bg-accent-secondary shadow-[2px_2px_5px_2px_rgba(249,0,147,0.4)] hover:shadow-[3px_3px_5px_3px_rgba(164,92,255,0.4)] rounded-lg cursor-pointer font-bold sm:font-extrabold border border-accent/20 hover:border-accent-secondary/20 hover:rotate-2 transition-all duration-300"
          >
            Start Sharing
          </NavLink>
        </div>
      </div>

    {/* Card section */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
        <div className="relative bg-text/10 h-55 md:h-70">
          <DirectFileTransfer />
          <div className=" max-w-2/3 sm:max-w-1/2 mx-auto text-lg sm:text-xl md:text-2xl ">
            Directly <span className="text-accent-secondary">transfer</span> files <span className="text-accent-secondary">without</span> any <span className="text-accent-secondary">middleman</span>
          </div>
          <div className="svg-2 absolute bottom-0 w-full">
            <svg
              data-name="Layer 1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path
                d="M1200 120L0 16.48 0 0 1200 0 1200 120z"
                className="shape-fill"
              ></path>
            </svg>
          </div>
        </div>
        <div className="relative bg-accent/10 h-50 md:h-70">
          <div className="max-w-2/3 sm:max-w-1/2 mx-auto text-lg sm:text-xl md:text-2xl pt-12 sm:pt-16 ">
            Because your files <span className="text-accent-secondary">shouldn't go</span> halfway <span className="text-accent-secondary">around the world</span> to reach
            your friend
          </div>

          <div className="svg absolute top-0 w-full left-0 ">
            <svg
              data-name="Layer 1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path
                d="M1200 120L0 16.48 0 0 1200 0 1200 120z"
                className="shape-fill"
              ></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Card section 2 */}
      <h2 className="mt-8 text-3xl text-center">Feeling <span className="text-accent-secondary">Constraint</span>?</h2>

      <div className="mt-16 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        
          <FileTransferUsingServer/>
        
        <div className="bg-text/10">

        </div>
      </div>

    </div>
  );
}

export default LandingPage;
