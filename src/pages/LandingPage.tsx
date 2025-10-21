import { NavLink } from "react-router-dom";
import DirectFileTransfer from "../components/DirectFileTransfer";
import FileTransferUsingServer from "../components/FileTransferUsingServer";
import {
  ArrowLeftRight,
  CircleUserRound,
  File,
  Infinity,
  ShieldBan,
  Turtle,
} from "lucide-react";
import Footer from "../components/Footer";

function LandingPage() {
  return (
    <div className="my-8 sm:my-14 mx-6 sm:mx-10 ">
      <div className="h-64 w-64 rounded-full bg-transparent  absolute -top-10 -left-22 animate-glow shadow-[0_0_10px_2px_rgba(249,0,147,0.3)]" />
      <div className="h-82 w-82 rounded-full bg-transparent absolute top-8 -right-22 animate-glow shadow-[0_0_10px_2px_rgba(249,0,147,0.3)]" />

      <h1 className="text-5xl sm:text-6xl text-center  font-bungee">
        <span className="text-accent">Link</span>
        <span>It</span>
      </h1>
      <h4 className="text-center text-xl sm:text-2xl md:text-3xl my-2 md:my-4 text-text-muted">
        Share files from{" "}
        <span className="text-accent-secondary">peer to peer</span> with{" "}
        <span className="text-accent-secondary">no limits</span>
      </h4>

      <div className="mt-16 mb-12">
        <div className="flex justify-center items-center flex-col gap-3">
          <NavLink
            to={"/dashboard"}
            className="px-5 sm:px-8 py-3 bg-accent hover:bg-accent-secondary shadow-[2px_2px_5px_2px_rgba(249,0,147,0.4)] hover:shadow-[3px_3px_5px_3px_rgba(164,92,255,0.4)] rounded-lg cursor-pointer font-bold sm:font-extrabold border border-accent/20 hover:border-accent-secondary/20 hover:rotate-2 transition-all duration-300"
          >
            Start Sharing
          </NavLink>

          <div>
            <span className="text-accent-secondary">No Signup</span> required
          </div>
        </div>
      </div>

      {/* Card section */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
        <div className="relative bg-text/10 shadow-[0_0_3px_2px_rgba(255,255,255,0.3)] h-55 md:h-70">
          <DirectFileTransfer />
          <div className=" max-w-2/3 sm:max-w-1/2 mx-auto text-lg font-bold sm:text-xl md:text-2xl ">
            Directly <span className="text-accent-secondary">transfer</span>{" "}
            files <span className="text-accent-secondary">without</span> any{" "}
            <span className="text-accent-secondary">middleman</span>
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
        <div className="relative bg-accent/10 shadow-[0_0_3px_2px_rgba(249,0,147,0.3)] h-50 md:h-70">
          <div className="max-w-2/3 sm:max-w-1/2 mx-auto text-lg font-bold sm:text-xl md:text-2xl pt-12 sm:pt-16 ">
            Because your{" "}
            <span className="text-accent-secondary">files shouldn't go</span>{" "}
            halfway{" "}
            <span className="text-accent-secondary">around the world</span> to
            reach your friend
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
      <h2 className="mt-8 sm:mt-12 text-3xl sm:text-4xl text-center">
        Why <span className="text-accent font-bold">Link</span>
        <span className="font-bold">It</span>?
      </h2>

      <div className="mt-8 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-7">
        <div className="bg-highlight-accent/90 shadow-[2px_2px_8px_3px_rgba(249,0,147,0.4)] hover:rotate-3 transition-transform duration-300">
          <div className="pl-5 pr-2 pt-5 pb-2">
            <h5 className="sm:text-lg font-bold mb-3 ">
              Most platforms use{" "}
              <span className="text-accent-secondary font-extrabold">
                servers and databases
              </span>{" "}
              as <span className="text-accent-secondary">middlemen</span> for
              file transfer, which results in:
            </h5>
            <ul className="font-medium space-y-2 mt-4 mb-3 sm:pl-3 text-md sm:text-lg ">
              <li className="flex gap-3 items-center">
                <span className="p-2 bg-accent-secondary rounded-lg">
                  <Turtle className="text-text" />
                </span>{" "}
                Slower Transfer rate
              </li>
              <li className="flex gap-3 items-center">
                <span className="p-2 bg-accent-secondary rounded-lg">
                  <File />
                </span>
                Limited file size
              </li>
              <li className="flex gap-3 items-center">
                <span className="p-2 bg-accent-secondary rounded-lg">
                  <ShieldBan />
                </span>{" "}
                Privacy concerns
              </li>
            </ul>
          </div>
        </div>

        <div className="border-2 shadow-[-2px_2px_5px_1px_rgba(255,255,255,0.2)] flex flex-col justify-center bg-text/10">
          <FileTransferUsingServer />
        </div>
      </div>

      <div className="bg-highlight-soft -rotate-2 hover:rotate-0 transition-transform duration-300 max-w-xl mx-auto ">
        <div className="bg-highlight-secondary px-4 sm:px-6 py-6 md:mt-8 translate-x-2 translate-y-2 shadow-[-2px_-2px_4px_2px_rgba(255,255,255,0.4)]">
          <h5 className="text-center text-lg sm:text-xl font-bold">
            What We Offer?
          </h5>
          <ul className="space-y-2 pt-4">
            <li className="flex items-center gap-3">
              {" "}
              <span className="p-2 rounded-lg bg-accent-secondary">
                <ArrowLeftRight />
              </span>{" "}
              Direct peer-to-peer file transfer powered by WebRTC
            </li>
            <li className="flex items-center gap-3">
              {" "}
              <span className="p-2 rounded-lg bg-accent-secondary">
                <CircleUserRound />
              </span>
              No sign-ups, no servers, just instant sharing
            </li>
            <li className="flex items-center gap-3">
              {" "}
              <span className="p-2 rounded-lg bg-accent-secondary">
                <Infinity />
              </span>
              Unlimited file size, limited only by your connection
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-10 flex justify-center items-center flex-col gap-3">
        <NavLink
          to={"/dashboard"}
          className="px-5 sm:px-8 py-3 bg-accent hover:bg-accent-secondary shadow-[2px_2px_5px_2px_rgba(249,0,147,0.4)] hover:shadow-[3px_3px_5px_3px_rgba(164,92,255,0.4)] rounded-lg cursor-pointer font-bold sm:font-extrabold border border-accent/20 hover:border-accent-secondary/20 hover:rotate-2 transition-all duration-300"
        >
          Try Now
        </NavLink>
      </div>
    </div>
  );
}

export default LandingPage;
