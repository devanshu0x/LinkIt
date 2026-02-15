import type { ReactNode } from "react"
import { Toaster } from "react-hot-toast"

type ProviderProps={
    children:ReactNode
}

function Providers({children}:ProviderProps) {
  return (
    <div>
        <Toaster toastOptions={{className:"",
          style:{
            backgroundColor: "black",
            border: "1px solid white",
            color:"white"
          }
        }} />
        {children}
    </div>
  )
}

export default Providers