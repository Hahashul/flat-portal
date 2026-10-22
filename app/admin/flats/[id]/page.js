'use client'
import { useParams } from 'next/navigation'
import FlatForm from '@/components/FlatForm'
import FlatDocuments from '@/components/FlatDocuments'

export default function EditFlat() {
  const { id } = useParams()
  return (
    <FlatForm flatId={id}>
      <FlatDocuments flatId={id} />
    </FlatForm>
  )
}