
interface Props{
    title:String;
    onClick: ()=>void;
}

function Container({title, onClick}:Props) {
  return (
    <div onClick={onClick} className='bg-red-200 border m-2 px-8 max-w-sm hover:cursor-pointer '>
    
    <div className="flex justify-center items-center h-40">
        <h4 className="text-center px-4 py-2 text-lg sm:text-xl">{title}</h4>

    </div>
    </div>
  )
}

export default Container