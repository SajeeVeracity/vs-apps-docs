import type { ReactElement } from 'react';
import Content from '@theme-original/DocItem/Content';
import type { WrapperProps } from '@docusaurus/types';
import VerifiedStamp from '../../../components/VerifiedStamp';

type Props = WrapperProps<typeof Content>;

export default function ContentWrapper(props: Props): ReactElement {
  return (
    <>
      <Content {...props} />
      <VerifiedStamp />
    </>
  );
}
