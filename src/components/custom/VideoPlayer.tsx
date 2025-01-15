interface VideoPlayerProps {
  src: string;
  title?: string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  title,
  autoPlay = false,
  loop = false,
  className,
}) => {
  return (
    <div className={`mx-auto my-4 max-w-xl ${className}`}>
      <video
        className='w-full rounded-lg shadow-md'
        controls
        src={src}
        title={title}
        autoPlay={autoPlay}
        loop={loop}
      >
        Your browser does not support the video tag.
      </video>
      {title && <p className='mt-2 text-center text-gray-700'>{title}</p>}
    </div>
  );
};

export default VideoPlayer;
