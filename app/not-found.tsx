import Link from "next/link";
import { Wordmark } from "@/components/spotlit/Brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink px-6 text-center text-white">
      <Wordmark width={140} />
      <h1 className="serif m-0 text-6xl leading-none">Nothing in the spotlight here.</h1>
      <p className="m-0 text-mist">That page does not exist, or it is not yours to see.</p>
      <div className="flex gap-2">
        <Link href="/" className="btn btn-white">Home</Link>
        <Link href="/demo" className="btn btn-line-dark">Open the demo</Link>
      </div>
    </div>
  );
}
