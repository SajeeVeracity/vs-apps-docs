import type { ReactElement } from 'react';
import Layout from '@theme-original/Layout';
import type { WrapperProps } from '@docusaurus/types';
import FlavourRoute from '../../components/FlavourRoute';

type Props = WrapperProps<typeof Layout>;

export default function LayoutWrapper(props: Props): ReactElement {
  return (
    <>
      <FlavourRoute />
      <Layout {...props} />
    </>
  );
}
