import React, { useEffect, useRef } from "react"
import { RecognizeResult, createWorker } from "tesseract.js"
import { useDropzone } from "react-dropzone"
import { signal } from "@preact/signals-react"
import { nanoid } from "nanoid"
import clsx from "clsx"
import {
  CaretRightIcon,
  ClipboardCopyIcon,
  FileIcon,
  FileTextIcon,
  GitHubLogoIcon,
  ImageIcon,
} from "@radix-ui/react-icons"
import { Slide, ToastContainer, toast } from "react-toastify"

import "./css-reset.css"
import "react-toastify/dist/ReactToastify.css"
import "./App.scss"
import "animate.css"

interface UploadedFile extends File {
  ai: RecognizeResult
  preview: string
  id: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const $progress = signal(0)
const $currentText = signal({ id: "", text: "" })
const $files = signal<UploadedFile[]>([])

const worker = await createWorker({
  logger: (m) => {
    if (m.status === "recognizing text") {
      if (m.progress < 0.8) {
        $progress.value = m.progress
      } else {
        $progress.value = 0.9999
      }
      if (m.progress === 1) {
        setTimeout(() => {
          $progress.value = 0
        }, 300)
      }
    }
  },
})

await worker.loadLanguage("eng")
await worker.initialize("eng")

export const App = () => {
  return (
    <div className="app">
      <a
        href="https://github.com/Laosing/image-to-text-converter"
        target="_blank"
        className="github-link"
      >
        <GitHubLogoIcon />
      </a>
      <Header />
      <DropZone />
      <TextArea />
      <ToastContainer
        position="top-center"
        autoClose={3000}
        transition={Slide}
        hideProgressBar
      />
    </div>
  )
}

const Header = () => {
  return (
    <header className="header">
      <div className="header-icons">
        <ImageIcon color="#666" />
        <CaretRightIcon color="#999" />
        <FileTextIcon color="#666" />
      </div>
      <h1>Image to text converter</h1>
      <p>
        Drag your images you would like to convert into text in the box below
      </p>
    </header>
  )
}

const TextArea = () => {
  const ref = useRef<HTMLTextAreaElement>(null)

  const copyLink = () => {
    ref.current?.select()
    document.execCommand("copy")
    toast.success("Copied!")
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    $currentText.value = { id: $currentText.value.id, text: e.target.value }
  }

  return (
    <div className="textarea">
      <button onClick={copyLink}>
        <ClipboardCopyIcon />
      </button>
      <textarea
        rows={3}
        ref={ref}
        value={$currentText.value.text}
        onChange={onChange}
      />
    </div>
  )
}

function DropZone() {
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "image/*": [],
    },
    disabled: $progress.value > 0,
    onDrop: async (acceptedFiles) => {
      if (!acceptedFiles.length) return

      for (const file of acceptedFiles) {
        Object.assign(file, {
          ai: await worker.recognize(file),
          preview: URL.createObjectURL(file),
          id: nanoid(),
        })
        const newFile = file as unknown as UploadedFile
        $files.value = [...$files.value, newFile]
        $currentText.value = { id: newFile.id, text: newFile.ai.data.text }
        await sleep(1000)
      }
    },
    onDropRejected: () => {
      toast.error("That file format is not supported.")
    },
  })

  useEffect(() => {
    // Make sure to revoke the data uris to avoid memory leaks, will run on unmount
    return () =>
      $files.value.forEach((file) => URL.revokeObjectURL(file.preview))
  }, [])

  return (
    <section className="container">
      <div
        {...getRootProps({
          className: clsx("dropzone", $progress.value && "disabled"),
        })}
      >
        <div
          className={clsx(
            "progress",
            $progress.value && "progress-transition",
            $progress.value === 1 && "progress-done"
          )}
          style={{
            width: `${$progress.value * 100}%`,
          }}
        ></div>
        <input {...getInputProps()} />
        <p className="dropzone-text">
          <FileIcon className="dropzone-icon" />
          Drag some files here, or click to select files
        </p>
      </div>
      <aside className="thumbsContainer">
        {$files.value.map((file) => (
          <div
            key={file.id}
            className={clsx(
              "thumb animate__animated animate__bounceIn",
              $currentText.value.id === file.id && "active"
            )}
          >
            <img
              className="img"
              width={100}
              src={file.preview}
              // Revoke data uri after image is loaded
              onLoad={() => {
                URL.revokeObjectURL(file.preview)
              }}
              onClick={() => {
                $currentText.value = { id: file.id, text: file.ai.data.text }
              }}
            />
          </div>
        ))}
      </aside>
    </section>
  )
}

export default App
